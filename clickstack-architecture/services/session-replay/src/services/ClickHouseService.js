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
      await this.client.insert({
        table: table,
        values: data,
      });
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

  isConnected() {
    return this.connected;
  }
}

module.exports = ClickHouseService;