const { ClickHouseClient } = require('@clickhouse/client');
const logger = require('../utils/logger');

class ClickHouseService {
  constructor() {
    const host = process.env.CLICKHOUSE_HOST || 'clickhouse';
    const port = process.env.CLICKHOUSE_PORT || '8123';
    
    this.client = new ClickHouseClient({
      url: `http://${host}:${port}`,
      database: process.env.CLICKHOUSE_DATABASE || 'airis_mon',
      username: process.env.CLICKHOUSE_USER || 'admin',
      password: process.env.CLICKHOUSE_PASSWORD || 'airis_secure_2024',
    });
    this.connected = false;
  }

  async query(sql, params = {}) {
    try {
      logger.debug('Executing ClickHouse query:', { sql, params });
      const result = await this.client.query({
        query: sql,
        query_params: params,
      });
      return await result.json();
    } catch (error) {
      logger.error('ClickHouse query error:', error);
      throw error;
    }
  }

  async insert(table, data) {
    try {
      logger.debug('Inserting data to ClickHouse:', { table, count: data.length });
      await this.client.insert({
        table: table,
        values: data,
      });
      logger.info('Successfully inserted data to ClickHouse', { table, count: data.length });
    } catch (error) {
      logger.error('ClickHouse insert error:', error);
      throw error;
    }
  }

  async connect() {
    try {
      await this.client.query({ query: 'SELECT 1' });
      this.connected = true;
      logger.info('ClickHouse 연결 성공');
    } catch (error) {
      logger.error('ClickHouse 연결 실패:', error);
      this.connected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.close();
      this.connected = false;
      logger.info('ClickHouse 연결 해제 완료');
    } catch (error) {
      logger.error('ClickHouse 연결 해제 실패:', error);
    }
  }

  isConnected() {
    return this.connected;
  }

  async checkHealth() {
    try {
      await this.client.query({ query: 'SELECT 1' });
      return true;
    } catch (error) {
      logger.error('ClickHouse health check failed:', error);
      return false;
    }
  }
}

module.exports = ClickHouseService;