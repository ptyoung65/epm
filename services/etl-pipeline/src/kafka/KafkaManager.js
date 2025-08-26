const { Admin, Producer, Consumer } = require('kafkajs');

class KafkaManager {
  constructor(kafka, logger) {
    this.kafka = kafka;
    this.logger = logger;
    this.admin = null;
    this.producer = null;
    this.consumers = new Map();
    this.status = 'initializing';
    this.topics = new Set();
  }

  async initialize() {
    try {
      this.admin = this.kafka.admin();
      await this.admin.connect();
      
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        transactionTimeout: 30000,
        idempotent: true,
        maxInFlightRequests: 5,
        retry: {
          retries: 10,
          initialRetryTime: 100,
          maxRetryTime: 30000
        }
      });
      await this.producer.connect();

      // Create default topics
      await this.createDefaultTopics();
      
      this.status = 'connected';
      this.logger.info('Kafka Manager initialized successfully');
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to initialize Kafka Manager:', error);
      throw error;
    }
  }

  async createDefaultTopics() {
    const defaultTopics = [
      { name: 'airis-epm-metrics', partitions: 6, replicationFactor: 2 },
      { name: 'airis-epm-logs', partitions: 6, replicationFactor: 2 },
      { name: 'airis-epm-traces', partitions: 6, replicationFactor: 2 },
      { name: 'airis-epm-events', partitions: 3, replicationFactor: 2 },
      { name: 'airis-epm-alerts', partitions: 3, replicationFactor: 2 },
      { name: 'airis-epm-business-metrics', partitions: 3, replicationFactor: 2 },
      { name: 'airis-epm-performance', partitions: 6, replicationFactor: 2 },
      { name: 'airis-epm-errors', partitions: 3, replicationFactor: 2 },
      { name: 'airis-epm-dlq', partitions: 3, replicationFactor: 2 }, // Dead Letter Queue
      { name: 'airis-epm-processed', partitions: 6, replicationFactor: 2 }
    ];

    try {
      const existingTopics = await this.admin.listTopics();
      
      const topicsToCreate = defaultTopics.filter(
        topic => !existingTopics.includes(topic.name)
      );

      if (topicsToCreate.length > 0) {
        await this.admin.createTopics({
          topics: topicsToCreate.map(topic => ({
            topic: topic.name,
            numPartitions: topic.partitions,
            replicationFactor: topic.replicationFactor,
            configEntries: [
              { name: 'retention.ms', value: '604800000' }, // 7 days
              { name: 'compression.type', value: 'lz4' },
              { name: 'max.message.bytes', value: '5242880' }, // 5MB
              { name: 'min.insync.replicas', value: '2' }
            ]
          }))
        });
        
        this.logger.info(`Created ${topicsToCreate.length} default topics`);
        topicsToCreate.forEach(topic => this.topics.add(topic.name));
      }

      existingTopics.forEach(topic => this.topics.add(topic));
    } catch (error) {
      this.logger.error('Error creating default topics:', error);
      throw error;
    }
  }

  async createTopic(topicName, partitions = 3, replicationFactor = 2) {
    try {
      await this.admin.createTopics({
        topics: [{
          topic: topicName,
          numPartitions: partitions,
          replicationFactor: replicationFactor,
          configEntries: [
            { name: 'retention.ms', value: '604800000' },
            { name: 'compression.type', value: 'lz4' },
            { name: 'max.message.bytes', value: '5242880' }
          ]
        }]
      });
      
      this.topics.add(topicName);
      this.logger.info(`Topic ${topicName} created successfully`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        this.logger.warn(`Topic ${topicName} already exists`);
        this.topics.add(topicName);
      } else {
        throw error;
      }
    }
  }

  async listTopics() {
    try {
      const topics = await this.admin.listTopics();
      topics.forEach(topic => this.topics.add(topic));
      return topics;
    } catch (error) {
      this.logger.error('Error listing topics:', error);
      throw error;
    }
  }

  async produce(topic, messages, key = null) {
    try {
      const result = await this.producer.send({
        topic,
        messages: Array.isArray(messages) ? messages : [messages].map(msg => ({
          key: key || null,
          value: typeof msg === 'string' ? msg : JSON.stringify(msg),
          timestamp: Date.now().toString()
        }))
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error producing to topic ${topic}:`, error);
      throw error;
    }
  }

  async produceBatch(records) {
    try {
      const topicMessages = {};
      
      records.forEach(record => {
        if (!topicMessages[record.topic]) {
          topicMessages[record.topic] = [];
        }
        topicMessages[record.topic].push({
          key: record.key || null,
          value: typeof record.value === 'string' ? record.value : JSON.stringify(record.value),
          timestamp: Date.now().toString(),
          headers: record.headers || {}
        });
      });

      const batch = Object.entries(topicMessages).map(([topic, messages]) => ({
        topic,
        messages
      }));

      const result = await this.producer.sendBatch({ topicMessages: batch });
      return result;
    } catch (error) {
      this.logger.error('Error in batch production:', error);
      throw error;
    }
  }

  async createConsumer(groupId, topics, handler) {
    try {
      const consumer = this.kafka.consumer({ 
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576, // 1MB
        retry: {
          retries: 10
        }
      });

      await consumer.connect();
      await consumer.subscribe({ 
        topics: Array.isArray(topics) ? topics : [topics], 
        fromBeginning: false 
      });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const value = message.value ? JSON.parse(message.value.toString()) : null;
            await handler({
              topic,
              partition,
              offset: message.offset,
              key: message.key ? message.key.toString() : null,
              value,
              timestamp: message.timestamp,
              headers: message.headers
            });
          } catch (error) {
            this.logger.error(`Error processing message from ${topic}:`, error);
            // Send to DLQ
            await this.sendToDLQ(topic, message, error);
          }
        }
      });

      this.consumers.set(groupId, consumer);
      this.logger.info(`Consumer ${groupId} created for topics: ${topics}`);
      
      return consumer;
    } catch (error) {
      this.logger.error(`Error creating consumer ${groupId}:`, error);
      throw error;
    }
  }

  async sendToDLQ(originalTopic, message, error) {
    try {
      await this.produce('airis-epm-dlq', {
        originalTopic,
        originalMessage: message,
        error: error.message,
        timestamp: Date.now(),
        retryCount: (message.headers?.retryCount || 0) + 1
      });
    } catch (dlqError) {
      this.logger.error('Failed to send message to DLQ:', dlqError);
    }
  }

  async getTopicMetadata(topic) {
    try {
      const metadata = await this.admin.fetchTopicMetadata({ topics: [topic] });
      return metadata.topics[0];
    } catch (error) {
      this.logger.error(`Error fetching metadata for topic ${topic}:`, error);
      throw error;
    }
  }

  async getConsumerGroupOffsets(groupId) {
    try {
      const offsets = await this.admin.fetchOffsets({ groupId });
      return offsets;
    } catch (error) {
      this.logger.error(`Error fetching offsets for group ${groupId}:`, error);
      throw error;
    }
  }

  async disconnect() {
    try {
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        this.logger.info(`Consumer ${groupId} disconnected`);
      }
      
      if (this.producer) {
        await this.producer.disconnect();
        this.logger.info('Producer disconnected');
      }
      
      if (this.admin) {
        await this.admin.disconnect();
        this.logger.info('Admin disconnected');
      }
      
      this.status = 'disconnected';
    } catch (error) {
      this.logger.error('Error disconnecting Kafka Manager:', error);
      throw error;
    }
  }
}

module.exports = KafkaManager;