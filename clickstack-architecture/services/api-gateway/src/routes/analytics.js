const express = require('express');

class AnalyticsRoutes {
  constructor(clickhouse, logger) {
    this.clickhouse = clickhouse;
    this.logger = logger;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    this.router.get('/anomalies', this.getAnomalies.bind(this));
    this.router.get('/risk-scores', this.getRiskScores.bind(this));
    this.router.get('/trends', this.getTrends.bind(this));
    this.router.get('/patterns', this.getPatterns.bind(this));
    this.router.get('/forecasting', this.getForecasting.bind(this));
  }

  async getAnomalies(req, res) {
    try {
      const { hours = 24, threshold = 2.0 } = req.query;

      const query = `
        WITH stats AS (
          SELECT 
            metric_name,
            metric_type,
            AVG(value) as mean_value,
            stddevPop(value) as std_value
          FROM metrics 
          WHERE timestamp >= now() - INTERVAL ${hours * 2} HOUR
          GROUP BY metric_name, metric_type
        ),
        recent_data AS (
          SELECT 
            m.*,
            formatDateTime(m.timestamp, '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_time,
            s.mean_value,
            s.std_value,
            abs(m.value - s.mean_value) / nullIf(s.std_value, 0) as z_score
          FROM metrics m
          JOIN stats s ON m.metric_name = s.metric_name AND m.metric_type = s.metric_type
          WHERE m.timestamp >= now() - INTERVAL ${hours} HOUR
        )
        SELECT 
          metric_name,
          metric_type,
          value,
          korean_time,
          mean_value,
          z_score,
          CASE 
            WHEN z_score > ${threshold * 2} THEN 'critical'
            WHEN z_score > ${threshold} THEN 'high'
            ELSE 'medium'
          END as severity
        FROM recent_data
        WHERE z_score > ${threshold}
        ORDER BY z_score DESC
        LIMIT 50
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        anomalies: result.data || [],
        threshold,
        period: `최근 ${hours}시간`,
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('이상징후 조회 실패', { error: error.message });
      res.status(500).json({
        error: '이상징후 조회 실패',
        message: error.message
      });
    }
  }

  async getRiskScores(req, res) {
    try {
      const query = `
        WITH metric_stats AS (
          SELECT 
            metric_name,
            metric_type,
            COUNT(*) as event_count,
            AVG(value) as avg_value,
            stddevPop(value) as std_value,
            quantile(0.95)(value) as p95_value,
            MAX(value) as max_value
          FROM metrics 
          WHERE timestamp >= now() - INTERVAL 24 HOUR
          GROUP BY metric_name, metric_type
        ),
        risk_calculation AS (
          SELECT 
            *,
            CASE 
              WHEN std_value = 0 THEN 0
              WHEN p95_value > avg_value * 3 THEN 0.9
              WHEN p95_value > avg_value * 2 THEN 0.7
              WHEN std_value > avg_value THEN 0.5
              ELSE 0.2
            END as volatility_score,
            CASE 
              WHEN max_value > avg_value * 5 THEN 0.8
              WHEN max_value > avg_value * 3 THEN 0.6
              WHEN max_value > avg_value * 2 THEN 0.4
              ELSE 0.2
            END as spike_score
          FROM metric_stats
        )
        SELECT 
          metric_name,
          metric_type,
          event_count,
          round(avg_value, 2) as avg_value,
          round(volatility_score, 2) as volatility_score,
          round(spike_score, 2) as spike_score,
          round((volatility_score + spike_score) / 2, 2) as risk_score,
          CASE 
            WHEN (volatility_score + spike_score) / 2 > 0.8 THEN '높음'
            WHEN (volatility_score + spike_score) / 2 > 0.5 THEN '중간'
            ELSE '낮음'
          END as risk_level
        FROM risk_calculation
        ORDER BY risk_score DESC
        LIMIT 30
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        risk_scores: result.data || [],
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('위험점수 조회 실패', { error: error.message });
      res.status(500).json({
        error: '위험점수 조회 실패',
        message: error.message
      });
    }
  }

  async getTrends(req, res) {
    try {
      const { days = 7, metric_name } = req.query;

      const whereClause = metric_name ? `AND metric_name = '${metric_name}'` : '';

      const query = `
        WITH daily_stats AS (
          SELECT 
            formatDateTime(timestamp, '%Y-%m-%d', 'Asia/Seoul') as date_korean,
            formatDateTime(timestamp, '%m/%d', 'Asia/Seoul') as date_label,
            metric_name,
            metric_type,
            AVG(value) as avg_value,
            COUNT(*) as event_count
          FROM metrics 
          WHERE timestamp >= now() - INTERVAL ${days} DAY
          ${whereClause}
          GROUP BY date_korean, date_label, metric_name, metric_type
        ),
        trend_calculation AS (
          SELECT 
            *,
            LAG(avg_value, 1) OVER (PARTITION BY metric_name, metric_type ORDER BY date_korean) as prev_value,
            avg_value - LAG(avg_value, 1) OVER (PARTITION BY metric_name, metric_type ORDER BY date_korean) as change_value
          FROM daily_stats
        )
        SELECT 
          date_korean,
          date_label,
          metric_name,
          metric_type,
          round(avg_value, 2) as avg_value,
          event_count,
          round(change_value, 2) as change_value,
          CASE 
            WHEN change_value > 0 THEN '증가'
            WHEN change_value < 0 THEN '감소'
            ELSE '변화없음'
          END as trend_direction,
          CASE 
            WHEN abs(change_value) > prev_value * 0.2 THEN '큰변화'
            WHEN abs(change_value) > prev_value * 0.1 THEN '보통변화'
            ELSE '작은변화'
          END as change_magnitude
        FROM trend_calculation
        WHERE prev_value IS NOT NULL
        ORDER BY date_korean DESC, metric_name
        LIMIT 100
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        trends: result.data || [],
        period: `최근 ${days}일`,
        metric_filter: metric_name || '전체',
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('트렌드 분석 실패', { error: error.message });
      res.status(500).json({
        error: '트렌드 분석 실패',
        message: error.message
      });
    }
  }

  async getPatterns(req, res) {
    try {
      const query = `
        WITH hourly_patterns AS (
          SELECT 
            toHour(timestamp, 'Asia/Seoul') as korean_hour,
            toDayOfWeek(timestamp, 'Asia/Seoul') as day_of_week,
            metric_type,
            AVG(value) as avg_value,
            COUNT(*) as event_count
          FROM metrics 
          WHERE timestamp >= now() - INTERVAL 14 DAY
          GROUP BY korean_hour, day_of_week, metric_type
        ),
        pattern_analysis AS (
          SELECT 
            korean_hour,
            CASE 
              WHEN day_of_week IN (1,2,3,4,5) THEN '평일'
              ELSE '주말'
            END as day_type,
            CASE 
              WHEN korean_hour BETWEEN 9 AND 17 THEN '업무시간'
              WHEN korean_hour BETWEEN 18 AND 21 THEN '저녁시간'
              WHEN korean_hour BETWEEN 22 AND 6 THEN '야간시간'
              ELSE '기타시간'
            END as time_category,
            metric_type,
            AVG(avg_value) as pattern_avg,
            SUM(event_count) as total_events
          FROM hourly_patterns
          GROUP BY korean_hour, day_type, time_category, metric_type
        )
        SELECT 
          korean_hour,
          day_type,
          time_category,
          metric_type,
          round(pattern_avg, 2) as pattern_avg,
          total_events,
          round(total_events::Float / 14, 0) as daily_avg_events
        FROM pattern_analysis
        WHERE total_events > 10
        ORDER BY korean_hour, day_type, metric_type
        LIMIT 200
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        patterns: result.data || [],
        analysis_period: '최근 14일',
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('패턴 분석 실패', { error: error.message });
      res.status(500).json({
        error: '패턴 분석 실패',
        message: error.message
      });
    }
  }

  async getForecasting(req, res) {
    try {
      const { metric_name, hours = 24 } = req.query;

      if (!metric_name) {
        return res.status(400).json({
          error: '메트릭 이름이 필요합니다',
          message: 'metric_name 파라미터를 포함해주세요'
        });
      }

      const query = `
        WITH time_series AS (
          SELECT 
            toStartOfHour(timestamp) as hour_bucket,
            AVG(value) as avg_value
          FROM metrics 
          WHERE metric_name = '${metric_name}'
            AND timestamp >= now() - INTERVAL 7 DAY
          GROUP BY hour_bucket
          ORDER BY hour_bucket
        ),
        trend_calculation AS (
          SELECT 
            hour_bucket,
            avg_value,
            LAG(avg_value, 1) OVER (ORDER BY hour_bucket) as prev_value,
            LAG(avg_value, 24) OVER (ORDER BY hour_bucket) as prev_day_value
          FROM time_series
        ),
        forecast_base AS (
          SELECT 
            AVG(avg_value) as baseline,
            AVG(avg_value - prev_value) as hourly_trend,
            stddevPop(avg_value) as volatility
          FROM trend_calculation
          WHERE prev_value IS NOT NULL
        )
        SELECT 
          '${metric_name}' as metric_name,
          round(baseline, 2) as baseline_value,
          round(hourly_trend, 4) as hourly_trend,
          round(volatility, 2) as volatility,
          round(baseline + (hourly_trend * ${hours}), 2) as forecasted_value,
          round(baseline + (hourly_trend * ${hours}) + volatility, 2) as upper_bound,
          round(baseline + (hourly_trend * ${hours}) - volatility, 2) as lower_bound,
          CASE 
            WHEN abs(hourly_trend * ${hours}) > volatility THEN '큰변화예상'
            WHEN abs(hourly_trend * ${hours}) > volatility * 0.5 THEN '보통변화예상'
            ELSE '안정적'
          END as forecast_confidence
        FROM forecast_base
      `;

      const result = await this.clickhouse.query(query);
      
      if (!result.data || result.data.length === 0) {
        return res.status(404).json({
          error: '예측 데이터 없음',
          message: `${metric_name}에 대한 충분한 데이터가 없습니다`
        });
      }

      res.json({
        status: '성공',
        forecasting: result.data[0],
        forecast_period: `${hours}시간 후`,
        based_on: '최근 7일 데이터',
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('예측 분석 실패', { error: error.message });
      res.status(500).json({
        error: '예측 분석 실패',
        message: error.message
      });
    }
  }
}

module.exports = AnalyticsRoutes;