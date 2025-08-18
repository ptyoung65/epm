const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

class KafkaService {
  constructor() {
    this.client = null;
    this.producer = null;
    this.consumer = null;
    this.connected = false;
    
    this.brokers = process.env.KAFKA_BROKERS ? 
      process.env.KAFKA_BROKERS.split(',') : ['kafka:9092'];
  }

  async connect() {
    try {
      this.client = new Kafka({
        clientId: 'airis-api-gateway',
        brokers: this.brokers,
        connectionTimeout: 10000,
        requestTimeout: 30000,
      });

      this.producer = this.client.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000,
      });

      await this.producer.connect();
      this.connected = true;
      logger.info('Kafka 연결 성공', { brokers: this.brokers });

    } catch (error) {
      logger.error('Kafka 연결 실패', { error: error.message });
      this.connected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.producer) {
        await this.producer.disconnect();
      }
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      this.connected = false;
      logger.info('Kafka 연결 해제 완료');
    } catch (error) {
      logger.error('Kafka 연결 해제 실패', { error: error.message });
    }
  }

  async publishEvent(topic, data) {
    if (!this.connected || !this.producer) {
      throw new Error('Kafka 연결되지 않음');
    }

    try {
      const message = {
        value: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          korean_time: new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul'
          }).format(new Date())
        })
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.debug('Kafka 메시지 전송 성공', { topic, messageSize: message.value.length });
    } catch (error) {
      logger.error('Kafka 메시지 전송 실패', { topic, error: error.message });
      throw error;
    }
  }

  async publishBatch(topic, messages) {
    if (!this.connected || !this.producer) {
      throw new Error('Kafka 연결되지 않음');
    }

    try {
      const kafkaMessages = messages.map(data => ({
        value: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          korean_time: new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul'
          }).format(new Date())
        })
      }));

      await this.producer.send({
        topic,
        messages: kafkaMessages
      });

      logger.info('Kafka 배치 전송 성공', { topic, count: messages.length });
    } catch (error) {
      logger.error('Kafka 배치 전송 실패', { topic, error: error.message });
      throw error;
    }
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = KafkaService;