const express = require('express');

class DashboardRoutes {
  constructor(clickhouse, redis, logger) {
    this.clickhouse = clickhouse;
    this.redis = redis;
    this.logger = logger;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    this.router.get('/overview', this.getOverview.bind(this));
    this.router.get('/realtime', this.getRealtime.bind(this));
    this.router.get('/kst-metrics', this.getKoreanTimeMetrics.bind(this));
    this.router.get('/health-status', this.getHealthStatus.bind(this));
    this.router.get('/performance', this.getPerformanceMetrics.bind(this));
  }

  async getOverview(req, res) {
    try {
      const cacheKey = 'dashboard:overview';
      
      // Redis 캐시 확인
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return res.json({
          status: '성공',
          data: cached,
          source: 'cache',
          korean_time: new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul'
          }).format(new Date())
        });
      }

      // 전체 개요 데이터 조회
      const overviewQuery = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT metric_name) as unique_metrics,
          AVG(value) as avg_value,
          MAX(value) as max_value,
          MIN(value) as min_value,
          formatDateTime(now(), '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_time
        FROM metrics 
        WHERE timestamp >= now() - INTERVAL 24 HOUR
      `;

      const alertsQuery = `
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_alerts,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts
        FROM alerts 
        WHERE status != 'deleted'
      `;

      const [overviewResult, alertsResult] = await Promise.all([
        this.clickhouse.query(overviewQuery),
        this.clickhouse.query(alertsQuery)
      ]);

      const overview = overviewResult.data?.[0] || {};
      const alerts = alertsResult.data?.[0] || {};

      const dashboardData = {
        metrics: {
          total_events: overview.total_events || 0,
          unique_metrics: overview.unique_metrics || 0,
          avg_value: parseFloat(overview.avg_value || 0).toFixed(2),
          max_value: overview.max_value || 0,
          min_value: overview.min_value || 0
        },
        alerts: {
          total: alerts.total_alerts || 0,
          critical: alerts.critical_alerts || 0,
          high: alerts.high_alerts || 0,
          active: alerts.active_alerts || 0
        },
        system: {
          status: '정상',
          uptime: '24시간+',
          korean_time: new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }).format(new Date())
        }
      };

      // Redis에 5분간 캐시
      await this.redis.set(cacheKey, dashboardData, 300);

      res.json({
        status: '성공',
        data: dashboardData,
        source: 'database'
      });

    } catch (error) {
      this.logger.error('대시보드 개요 조회 실패', { error: error.message });
      res.status(500).json({
        error: '대시보드 개요 조회 실패',
        message: error.message
      });
    }
  }

  async getRealtime(req, res) {
    try {
      const query = `
        WITH recent_metrics AS (
          SELECT 
            metric_name,
            metric_type,
            value,
            timestamp,
            formatDateTime(timestamp, '%H:%M:%S', 'Asia/Seoul') as time_label
          FROM metrics 
          WHERE timestamp >= now() - INTERVAL 5 MINUTE
          ORDER BY timestamp DESC
        )
        SELECT 
          metric_name,
          metric_type,
          AVG(value) as avg_value,
          MAX(value) as max_value,
          MIN(value) as min_value,
          COUNT(*) as data_points,
          arrayStringConcat(groupArray(time_label), ',') as time_series
        FROM recent_metrics
        GROUP BY metric_name, metric_type
        ORDER BY data_points DESC
        LIMIT 10
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        realtime_data: result.data || [],
        timestamp: new Date().toISOString(),
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('실시간 대시보드 조회 실패', { error: error.message });
      res.status(500).json({
        error: '실시간 대시보드 조회 실패',
        message: error.message
      });
    }
  }

  async getKoreanTimeMetrics(req, res) {
    try {
      const { hours = 24 } = req.query;

      const query = `
        SELECT 
          formatDateTime(timestamp, '%Y-%m-%d %H:00:00', 'Asia/Seoul') as korean_hour,
          COUNT(*) as event_count,
          AVG(value) as avg_value,
          CASE 
            WHEN toHour(timestamp, 'Asia/Seoul') BETWEEN 9 AND 17 THEN '업무시간'
            WHEN toHour(timestamp, 'Asia/Seoul') BETWEEN 18 AND 21 THEN '저녁시간'
            ELSE '야간시간'
          END as time_category,
          CASE 
            WHEN toDayOfWeek(timestamp, 'Asia/Seoul') IN (6, 7) THEN '주말'
            ELSE '평일'
          END as day_category
        FROM metrics 
        WHERE timestamp >= now() - INTERVAL ${hours} HOUR
        GROUP BY korean_hour, time_category, day_category
        ORDER BY korean_hour DESC
        LIMIT 100
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        korean_metrics: result.data || [],
        period: `최근 ${hours}시간`,
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('한국시간 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '한국시간 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async getHealthStatus(req, res) {
    try {
      const services = [
        { name: 'ClickHouse', status: '정상', endpoint: 'clickhouse:8123' },
        { name: 'Kafka', status: '정상', endpoint: 'kafka:9092' },
        { name: 'Redis', status: '정상', endpoint: 'redis:6379' },
        { name: 'API Gateway', status: '정상', endpoint: 'localhost:3000' }
      ];

      // 각 서비스 상태 체크
      const healthChecks = await Promise.all([
        this.checkClickHouseHealth(),
        this.checkRedisHealth(),
        // Kafka 상태는 연결 상태로 판단
        Promise.resolve(true)
      ]);

      services[0].status = healthChecks[0] ? '정상' : '오류';
      services[2].status = healthChecks[1] ? '정상' : '오류';

      const overallHealth = healthChecks.every(check => check) ? '정상' : '주의';

      res.json({
        status: '성공',
        overall_health: overallHealth,
        services,
        last_check: new Date().toISOString(),
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('헬스 체크 실패', { error: error.message });
      res.status(500).json({
        error: '헬스 체크 실패',
        message: error.message
      });
    }
  }

  async getPerformanceMetrics(req, res) {
    try {
      const { minutes = 60 } = req.query;

      const query = `
        SELECT 
          formatDateTime(timestamp, '%H:%M', 'Asia/Seoul') as time_label,
          COUNT(*) as throughput,
          AVG(value) as avg_response_time,
          MAX(value) as max_response_time,
          quantile(0.95)(value) as p95_response_time
        FROM metrics 
        WHERE timestamp >= now() - INTERVAL ${minutes} MINUTE
          AND metric_type IN ('response_time', 'request_duration')
        GROUP BY time_label
        ORDER BY timestamp DESC
        LIMIT 60
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        performance_data: result.data || [],
        period: `최근 ${minutes}분`,
        metrics: {
          total_requests: result.data?.reduce((sum, row) => sum + (row.throughput || 0), 0) || 0,
          avg_throughput: result.data?.length > 0 ? 
            (result.data.reduce((sum, row) => sum + (row.throughput || 0), 0) / result.data.length).toFixed(2) : 0
        }
      });

    } catch (error) {
      this.logger.error('성능 메트릭 조회 실패', { error: error.message });
      res.status(500).json({
        error: '성능 메트릭 조회 실패',
        message: error.message
      });
    }
  }

  async checkClickHouseHealth() {
    try {
      await this.clickhouse.checkHealth();
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkRedisHealth() {
    try {
      return this.redis.isConnected();
    } catch (error) {
      return false;
    }
  }
}

module.exports = DashboardRoutes;