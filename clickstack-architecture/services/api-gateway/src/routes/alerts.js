const express = require('express');

class AlertsRoutes {
  constructor(clickhouse, redis, logger) {
    this.clickhouse = clickhouse;
    this.redis = redis;
    this.logger = logger;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    this.router.get('/', this.getAlerts.bind(this));
    this.router.post('/', this.createAlert.bind(this));
    this.router.put('/:id', this.updateAlert.bind(this));
    this.router.delete('/:id', this.deleteAlert.bind(this));
    this.router.get('/:id', this.getAlert.bind(this));
    this.router.post('/:id/acknowledge', this.acknowledgeAlert.bind(this));
  }

  async getAlerts(req, res) {
    try {
      const { severity, status, limit = 50 } = req.query;

      const query = `
        SELECT 
          id,
          title,
          description,
          severity,
          status,
          metric_name,
          threshold_value,
          current_value,
          formatDateTime(created_at, '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_created_time,
          formatDateTime(updated_at, '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_updated_time
        FROM alerts 
        WHERE 1=1
        ${severity ? `AND severity = '${severity}'` : ''}
        ${status ? `AND status = '${status}'` : ''}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      const result = await this.clickhouse.query(query);
      
      res.json({
        status: '성공',
        alerts: result.data || [],
        count: result.data?.length || 0,
        korean_time: new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul'
        }).format(new Date())
      });

    } catch (error) {
      this.logger.error('알림 조회 실패', { error: error.message });
      res.status(500).json({
        error: '알림 조회 실패',
        message: error.message
      });
    }
  }

  async createAlert(req, res) {
    try {
      const {
        title,
        description,
        severity = 'medium',
        metric_name,
        threshold_value,
        condition = 'greater_than'
      } = req.body;

      if (!title || !metric_name || !threshold_value) {
        return res.status(400).json({
          error: '필수 필드 누락',
          message: 'title, metric_name, threshold_value가 필요합니다'
        });
      }

      const alertData = {
        id: `alert_${Date.now()}`,
        title,
        description: description || '',
        severity,
        status: 'active',
        metric_name,
        threshold_value: parseFloat(threshold_value),
        condition,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // ClickHouse에 저장
      await this.clickhouse.insert('alerts', [alertData]);
      
      // Redis에 캐시
      await this.redis.setHash('alerts', alertData.id, alertData);

      res.json({
        status: '성공',
        message: '알림이 생성되었습니다',
        alert: alertData
      });

    } catch (error) {
      this.logger.error('알림 생성 실패', { error: error.message });
      res.status(500).json({
        error: '알림 생성 실패',
        message: error.message
      });
    }
  }

  async updateAlert(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // 기존 알림 조회
      const existingQuery = `SELECT * FROM alerts WHERE id = '${id}' LIMIT 1`;
      const existingResult = await this.clickhouse.query(existingQuery);
      
      if (!existingResult.data || existingResult.data.length === 0) {
        return res.status(404).json({
          error: '알림을 찾을 수 없음',
          message: `ID ${id}에 해당하는 알림이 없습니다`
        });
      }

      const updatedAlert = {
        ...existingResult.data[0],
        ...updateData,
        updated_at: new Date().toISOString()
      };

      // ClickHouse 업데이트
      await this.clickhouse.insert('alerts', [updatedAlert]);
      
      // Redis 캐시 업데이트
      await this.redis.setHash('alerts', id, updatedAlert);

      res.json({
        status: '성공',
        message: '알림이 업데이트되었습니다',
        alert: updatedAlert
      });

    } catch (error) {
      this.logger.error('알림 업데이트 실패', { error: error.message });
      res.status(500).json({
        error: '알림 업데이트 실패',
        message: error.message
      });
    }
  }

  async deleteAlert(req, res) {
    try {
      const { id } = req.params;

      // 소프트 삭제 (status를 deleted로 변경)
      const deleteQuery = `
        INSERT INTO alerts 
        SELECT *, 'deleted' as status, now() as updated_at
        FROM alerts 
        WHERE id = '${id}' AND status != 'deleted'
        LIMIT 1
      `;

      await this.clickhouse.query(deleteQuery);
      
      // Redis에서 제거
      await this.redis.del(`alerts:${id}`);

      res.json({
        status: '성공',
        message: '알림이 삭제되었습니다'
      });

    } catch (error) {
      this.logger.error('알림 삭제 실패', { error: error.message });
      res.status(500).json({
        error: '알림 삭제 실패',
        message: error.message
      });
    }
  }

  async getAlert(req, res) {
    try {
      const { id } = req.params;

      // Redis에서 먼저 확인
      const cachedAlert = await this.redis.getHash('alerts', id);
      if (cachedAlert) {
        return res.json({
          status: '성공',
          alert: cachedAlert,
          source: 'cache'
        });
      }

      // ClickHouse에서 조회
      const query = `
        SELECT 
          *,
          formatDateTime(created_at, '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_created_time,
          formatDateTime(updated_at, '%Y-%m-%d %H:%M:%S', 'Asia/Seoul') as korean_updated_time
        FROM alerts 
        WHERE id = '${id}' AND status != 'deleted'
        ORDER BY updated_at DESC 
        LIMIT 1
      `;

      const result = await this.clickhouse.query(query);
      
      if (!result.data || result.data.length === 0) {
        return res.status(404).json({
          error: '알림을 찾을 수 없음',
          message: `ID ${id}에 해당하는 알림이 없습니다`
        });
      }

      const alert = result.data[0];
      
      // Redis에 캐시
      await this.redis.setHash('alerts', id, alert);

      res.json({
        status: '성공',
        alert,
        source: 'database'
      });

    } catch (error) {
      this.logger.error('알림 조회 실패', { error: error.message });
      res.status(500).json({
        error: '알림 조회 실패',
        message: error.message
      });
    }
  }

  async acknowledgeAlert(req, res) {
    try {
      const { id } = req.params;
      const { acknowledged_by } = req.body;

      const ackData = {
        status: 'acknowledged',
        acknowledged_by: acknowledged_by || 'system',
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 기존 알림 업데이트
      const updateQuery = `
        INSERT INTO alerts 
        SELECT *, '${ackData.status}' as status, 
               '${ackData.acknowledged_by}' as acknowledged_by,
               '${ackData.acknowledged_at}' as acknowledged_at,
               '${ackData.updated_at}' as updated_at
        FROM alerts 
        WHERE id = '${id}' AND status != 'deleted'
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      await this.clickhouse.query(updateQuery);
      
      // Redis 업데이트
      const existingAlert = await this.redis.getHash('alerts', id);
      if (existingAlert) {
        await this.redis.setHash('alerts', id, { ...existingAlert, ...ackData });
      }

      res.json({
        status: '성공',
        message: '알림이 확인되었습니다',
        acknowledged_by: ackData.acknowledged_by,
        acknowledged_at: ackData.acknowledged_at
      });

    } catch (error) {
      this.logger.error('알림 확인 실패', { error: error.message });
      res.status(500).json({
        error: '알림 확인 실패',
        message: error.message
      });
    }
  }
}

module.exports = AlertsRoutes;