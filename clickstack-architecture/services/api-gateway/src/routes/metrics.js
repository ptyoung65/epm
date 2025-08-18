const express = require('express');
const router = express.Router();

class MetricsRoutes {
  constructor(clickhouse, kafka, redis, logger) {
    this.clickhouse = clickhouse;
    this.kafka = kafka;
    this.redis = redis;
    this.logger = logger;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // 메트릭 조회
    this.router.get('/', this.getMetrics.bind(this));
    this.router.get('/stats', this.getMetricsStats.bind(this));
    this.router.get('/search', this.searchMetrics.bind(this));
    this.router.get('/realtime', this.getRealtimeMetrics.bind(this));
    
    // 메트릭 전송
    this.router.post('/', this.submitMetrics.bind(this));
    this.router.post('/batch', this.submitBatchMetrics.bind(this));
  }

  async getMetrics(req, res) {
    try {
      const { 
        start_time, 
        end_time, 
        metric_type, 
        limit = 100,
        offset = 0
      } = req.query;

      const query = `
        SELECT 
          metric_name,
          metric_type,
          value,
          formatDateTime(timestamp, '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_time,
          tags
        FROM metrics 
        WHERE 1=1
        ${start_time ? `AND timestamp >= '${start_time}'` : ''}
        ${end_time ? `AND timestamp <= '${end_time}'` : ''}
        ${metric_type ? `AND metric_type = '${metric_type}'` : ''}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        data: result.data || [],
        total: result.data?.length || 0,
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getMetricsStats(req, res) {
    try {
      const query = `
        SELECT 
          metric_type,
          COUNT(*) as count,
          AVG(value) as avg_value,
          MAX(value) as max_value,
          MIN(value) as min_value,
          formatDateTime(now(), '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_time
        FROM metrics 
        WHERE timestamp >= now() - INTERVAL 1 HOUR
        GROUP BY metric_type
        ORDER BY count DESC
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        stats: result.data || [],
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('메트릭 통계 조회 실패', { error: error.message });
      res.status(500).json({
        error: '메트릭 통계 조회 실패',
        message: error.message
      });
    }
  }

  async searchMetrics(req, res) {
    try {
      const { q: query, limit = 50 } = req.query;
      
      if (!query) {
        return res.status(400).json({
          error: '검색어가 필요합니다',
          message: 'q 파라미터를 포함해주세요'
        });
      }

      const searchQuery = `
        SELECT DISTINCT
          metric_name,
          metric_type,
          COUNT(*) as frequency
        FROM metrics 
        WHERE metric_name ILIKE '%${query}%' 
           OR metric_type ILIKE '%${query}%'
        GROUP BY metric_name, metric_type
        ORDER BY frequency DESC
        LIMIT ${limit}
      `;

      const result = await this.clickhouse.query(searchQuery);
      
      res.json({
        status: '성공',
        query,
        results: result.data || [],
        count: result.data?.length || 0
      });

    } catch (error) {
      this.logger.error('메트릭 검색 실패', { error: error.message });
      res.status(500).json({
        error: '메트릭 검색 실패',
        message: error.message
      });
    }
  }

  async getRealtimeMetrics(req, res) {
    try {
      const query = `
        SELECT 
          metric_type,
          metric_name,
          AVG(value) as avg_value,
          COUNT(*) as count,
          formatDateTime(now(), '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_time
        FROM metrics 
        WHERE timestamp >= now() - INTERVAL 30 SECOND
        GROUP BY metric_type, metric_name
        ORDER BY korean_time DESC
        LIMIT 20
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        realtime_data: result.data || [],
        timestamp: new Date().toISOString(),
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('실시간 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '실시간 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async submitMetrics(req, res) {
    try {
      const { metric_name, metric_type, value, tags = {} } = req.body;
      
      if (!metric_name || !metric_type || value === undefined) {
        return res.status(400).json({
          error: '필수 필드 누락',
          message: 'metric_name, metric_type, value가 필요합니다'
        });
      }

      const timestamp = new Date();
      const metricData = {
        metric_name,
        metric_type,
        value: parseFloat(value),
        timestamp: timestamp.toISOString(),
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(timestamp),
        tags: JSON.stringify(tags)
      };

      // Kafka로 전송
      await this.kafka.publishEvent('airis-mon-metrics', metricData);
      
      res.json({
        status: '성공',
        message: '메트릭이 성공적으로 전송되었습니다',
        metric: metricData
      });

    } catch (error) {
      this.logger.error('메트릭 전송 실패', { error: error.message });
      res.status(500).json({
        error: '메트릭 전송 실패',
        message: error.message
      });
    }
  }

  async submitBatchMetrics(req, res) {
    try {
      const { metrics } = req.body;
      
      if (!Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({
          error: '메트릭 배열이 필요합니다',
          message: 'metrics 배열을 포함해주세요'
        });
      }

      const timestamp = new Date();
      const processedMetrics = metrics.map(metric => ({
        ...metric,
        value: parseFloat(metric.value),
        timestamp: timestamp.toISOString(),
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(timestamp),
        tags: JSON.stringify(metric.tags || {})
      }));

      // Kafka로 배치 전송
      await this.kafka.publishBatch('airis-mon-metrics', processedMetrics);
      
      res.json({
        status: '성공',
        message: `${metrics.length}개의 메트릭이 성공적으로 전송되었습니다`,
        count: metrics.length
      });

    } catch (error) {
      this.logger.error('메트릭 배치 전송 실패', { error: error.message });
      res.status(500).json({
        error: '메트릭 배치 전송 실패',
        message: error.message
      });
    }
  }
}

module.exports = MetricsRoutes;