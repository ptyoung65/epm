import { Kafka, Consumer, Producer, KafkaMessage, EachMessagePayload } from 'kafkajs';
import { Logger } from 'winston';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface MessageBusConfig {
  clientId: string;
  brokers: string[];
  groupId?: string;
  logger: Logger;
  retries?: number;
  retryDelay?: number;
  requestTimeout?: number;
  connectionTimeout?: number;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

export interface PublishOptions {
  partition?: number;
  key?: string;
  headers?: Record<string, string>;
  timestamp?: string;
  acks?: 0 | 1 | -1;
  timeout?: number;
}

export interface SubscribeOptions {
  fromBeginning?: boolean;
  autoCommit?: boolean;
  sessionTimeout?: number;
  heartbeatInterval?: number;
}

export interface MessageMetadata {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key?: string;
  headers?: Record<string, string>;
}

export interface ProcessedMessage<T = any> {
  data: T;
  metadata: MessageMetadata;
  ack: () => Promise<void>;
  nack: () => Promise<void>;
}

export type MessageHandler<T = any> = (message: ProcessedMessage<T>) => Promise<void>;

export class MessageBus extends EventEmitter {
  private config: MessageBusConfig;
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private subscriptions: Map<string, MessageHandler[]> = new Map();
  private connected = false;

  constructor(config: MessageBusConfig) {
    super();
    this.config = {
      retries: 5,
      retryDelay: 300,
      requestTimeout: 30000,
      connectionTimeout: 1000,
      ...config
    };

    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      retry: {
        retries: this.config.retries!,
        initialRetryTime: this.config.retryDelay!,
        maxRetryTime: 30000
      },
      requestTimeout: this.config.requestTimeout,
      connectionTimeout: this.config.connectionTimeout,
      ssl: this.config.ssl,
      sasl: this.config.sasl,
      logLevel: this.getKafkaLogLevel()
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000
    });

    this.setupErrorHandlers();
  }

  /**
   * Get Kafka log level based on Winston level
   */
  private getKafkaLogLevel(): any {
    const logLevel = this.config.logger.level;
    
    switch (logLevel) {
      case 'error': return 1;
      case 'warn': return 2;
      case 'info': return 4;
      case 'debug': return 5;
      default: return 4;
    }
  }

  /**
   * Setup error handlers
   */
  private setupErrorHandlers(): void {
    this.producer.on('producer.connect', () => {
      this.config.logger.info('Kafka producer connected');
    });

    this.producer.on('producer.disconnect', () => {
      this.config.logger.warn('Kafka producer disconnected');
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      this.config.logger.warn('Kafka producer request timeout', payload);
    });

    this.on('error', (error) => {
      this.config.logger.error('MessageBus error:', error);
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      await this.producer.connect();
      this.connected = true;
      this.config.logger.info('MessageBus connected to Kafka');
      this.emit('connected');
    } catch (error) {
      this.config.logger.error('Failed to connect to Kafka:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      // Disconnect all consumers
      for (const [topic, consumer] of this.consumers) {
        try {
          await consumer.disconnect();
          this.config.logger.debug(`Consumer for topic ${topic} disconnected`);
        } catch (error) {
          this.config.logger.warn(`Error disconnecting consumer for topic ${topic}:`, error);
        }
      }
      
      this.consumers.clear();
      
      // Disconnect producer
      await this.producer.disconnect();
      
      this.connected = false;
      this.config.logger.info('MessageBus disconnected from Kafka');
      this.emit('disconnected');
    } catch (error) {
      this.config.logger.error('Error disconnecting from Kafka:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Publish message to topic
   */
  async publish<T = any>(
    topic: string,
    message: T,
    options: PublishOptions = {}
  ): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const messageId = uuidv4();
      
      const kafkaMessage = {
        key: options.key,
        value: JSON.stringify({
          id: messageId,
          data: message,
          timestamp: new Date().toISOString(),
          source: this.config.clientId
        }),
        partition: options.partition,
        timestamp: options.timestamp,
        headers: {
          ...options.headers,
          'message-id': messageId,
          'content-type': 'application/json',
          'producer': this.config.clientId
        }
      };

      await this.producer.send({
        topic,
        messages: [kafkaMessage],
        acks: options.acks ?? -1,
        timeout: options.timeout ?? 30000
      });

      this.config.logger.debug('Message published', {
        topic,
        messageId,
        partition: options.partition,
        key: options.key
      });

      this.emit('message.published', {
        topic,
        messageId,
        message,
        options
      });

    } catch (error) {
      this.config.logger.error('Failed to publish message:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Publish batch of messages
   */
  async publishBatch<T = any>(
    topic: string,
    messages: T[],
    options: PublishOptions = {}
  ): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const kafkaMessages = messages.map((message, index) => {
        const messageId = uuidv4();
        
        return {
          key: options.key ? `${options.key}-${index}` : undefined,
          value: JSON.stringify({
            id: messageId,
            data: message,
            timestamp: new Date().toISOString(),
            source: this.config.clientId
          }),
          partition: options.partition,
          headers: {
            ...options.headers,
            'message-id': messageId,
            'content-type': 'application/json',
            'producer': this.config.clientId,
            'batch-index': index.toString()
          }
        };
      });

      await this.producer.send({
        topic,
        messages: kafkaMessages,
        acks: options.acks ?? -1,
        timeout: options.timeout ?? 30000
      });

      this.config.logger.debug('Message batch published', {
        topic,
        count: messages.length,
        partition: options.partition
      });

      this.emit('batch.published', {
        topic,
        count: messages.length,
        messages,
        options
      });

    } catch (error) {
      this.config.logger.error('Failed to publish message batch:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Subscribe to topic
   */
  async subscribe<T = any>(
    topic: string,
    handler: MessageHandler<T>,
    options: SubscribeOptions = {}
  ): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      // Store handler
      if (!this.subscriptions.has(topic)) {
        this.subscriptions.set(topic, []);
      }
      this.subscriptions.get(topic)!.push(handler);

      // Create consumer if doesn't exist
      if (!this.consumers.has(topic)) {
        const consumer = this.kafka.consumer({
          groupId: this.config.groupId || `${this.config.clientId}-group`,
          sessionTimeout: options.sessionTimeout ?? 30000,
          heartbeatInterval: options.heartbeatInterval ?? 3000,
          allowAutoTopicCreation: true
        });

        // Setup consumer event handlers
        consumer.on('consumer.connect', () => {
          this.config.logger.debug(`Consumer connected for topic: ${topic}`);
        });

        consumer.on('consumer.disconnect', () => {
          this.config.logger.debug(`Consumer disconnected for topic: ${topic}`);
        });

        consumer.on('consumer.crash', (error) => {
          this.config.logger.error(`Consumer crashed for topic ${topic}:`, error);
          this.emit('consumer.error', { topic, error });
        });

        await consumer.connect();
        await consumer.subscribe({ 
          topic, 
          fromBeginning: options.fromBeginning ?? false 
        });

        // Start consuming
        await consumer.run({
          autoCommit: options.autoCommit ?? true,
          eachMessage: async (payload: EachMessagePayload) => {
            await this.processMessage(topic, payload);
          }
        });

        this.consumers.set(topic, consumer);
      }

      this.config.logger.info(`Subscribed to topic: ${topic}`);
      
    } catch (error) {
      this.config.logger.error(`Failed to subscribe to topic ${topic}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from topic
   */
  async unsubscribe(topic: string, handler?: MessageHandler): Promise<void> {
    try {
      if (handler) {
        // Remove specific handler
        const handlers = this.subscriptions.get(topic);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
          
          // If no handlers left, disconnect consumer
          if (handlers.length === 0) {
            await this.disconnectConsumer(topic);
          }
        }
      } else {
        // Remove all handlers and disconnect consumer
        this.subscriptions.delete(topic);
        await this.disconnectConsumer(topic);
      }
      
      this.config.logger.info(`Unsubscribed from topic: ${topic}`);
      
    } catch (error) {
      this.config.logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect consumer for specific topic
   */
  private async disconnectConsumer(topic: string): Promise<void> {
    const consumer = this.consumers.get(topic);
    if (consumer) {
      try {
        await consumer.disconnect();
        this.consumers.delete(topic);
        this.config.logger.debug(`Consumer disconnected for topic: ${topic}`);
      } catch (error) {
        this.config.logger.warn(`Error disconnecting consumer for topic ${topic}:`, error);
      }
    }
  }

  /**
   * Process incoming message
   */
  private async processMessage(topic: string, payload: EachMessagePayload): Promise<void> {
    const { message, partition, topic: msgTopic } = payload;
    
    try {
      // Parse message
      let parsedMessage: any;
      try {
        parsedMessage = JSON.parse(message.value!.toString());
      } catch (parseError) {
        this.config.logger.warn('Failed to parse message as JSON, using raw value', {
          topic,
          partition,
          offset: message.offset,
          error: parseError.message
        });
        parsedMessage = { data: message.value!.toString() };
      }

      // Create processed message
      const processedMessage: ProcessedMessage = {
        data: parsedMessage.data || parsedMessage,
        metadata: {
          topic: msgTopic,
          partition,
          offset: message.offset,
          timestamp: message.timestamp || new Date().toISOString(),
          key: message.key?.toString(),
          headers: this.parseHeaders(message.headers)
        },
        ack: async () => {
          // Kafka auto-commits by default, this is a no-op unless manual commit is enabled
        },
        nack: async () => {
          // For Kafka, we might want to throw an error to trigger retry mechanism
          throw new Error('Message processing failed');
        }
      };

      // Call all handlers for this topic
      const handlers = this.subscriptions.get(topic) || [];
      
      for (const handler of handlers) {
        try {
          await handler(processedMessage);
        } catch (handlerError) {
          this.config.logger.error(`Handler error for topic ${topic}:`, handlerError);
          this.emit('handler.error', {
            topic,
            message: processedMessage,
            error: handlerError
          });
          
          // Continue processing other handlers even if one fails
        }
      }

      this.emit('message.processed', {
        topic,
        message: processedMessage,
        handlersCount: handlers.length
      });

    } catch (error) {
      this.config.logger.error(`Error processing message from topic ${topic}:`, error);
      this.emit('message.error', {
        topic,
        partition,
        offset: message.offset,
        error
      });
      throw error;
    }
  }

  /**
   * Parse Kafka headers
   */
  private parseHeaders(headers?: any): Record<string, string> {
    if (!headers) return {};
    
    const parsed: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (Buffer.isBuffer(value)) {
        parsed[key] = (value as Buffer).toString();
      } else {
        parsed[key] = String(value);
      }
    }
    
    return parsed;
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get subscribed topics
   */
  getSubscribedTopics(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get consumer count
   */
  getConsumerCount(): number {
    return this.consumers.size;
  }

  /**
   * Get subscription stats
   */
  getStats(): any {
    return {
      connected: this.connected,
      subscribedTopics: this.getSubscribedTopics(),
      consumerCount: this.getConsumerCount(),
      totalHandlers: Array.from(this.subscriptions.values())
        .reduce((total, handlers) => total + handlers.length, 0)
    };
  }

  /**
   * Create topic (admin operation)
   */
  async createTopic(topic: string, partitions: number = 1, replicationFactor: number = 1): Promise<void> {
    const admin = this.kafka.admin();
    
    try {
      await admin.connect();
      
      const topicExists = await admin.listTopics();
      if (topicExists.includes(topic)) {
        this.config.logger.debug(`Topic ${topic} already exists`);
        return;
      }
      
      await admin.createTopics({
        topics: [{
          topic,
          numPartitions: partitions,
          replicationFactor
        }]
      });
      
      this.config.logger.info(`Topic created: ${topic}`);
      
    } catch (error) {
      this.config.logger.error(`Failed to create topic ${topic}:`, error);
      throw error;
    } finally {
      await admin.disconnect();
    }
  }

  /**
   * Delete topic (admin operation)
   */
  async deleteTopic(topic: string): Promise<void> {
    const admin = this.kafka.admin();
    
    try {
      await admin.connect();
      
      await admin.deleteTopics({
        topics: [topic]
      });
      
      this.config.logger.info(`Topic deleted: ${topic}`);
      
    } catch (error) {
      this.config.logger.error(`Failed to delete topic ${topic}:`, error);
      throw error;
    } finally {
      await admin.disconnect();
    }
  }
}