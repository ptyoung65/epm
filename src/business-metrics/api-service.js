/**
 * AIRIS EPM 비즈니스 메트릭 API 서비스
 * Express.js 기반 RESTful API 서버
 */

const express = require('express');
const cors = require('cors');

class BusinessMetricsAPIService {
  constructor(port = 3200) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // 로깅 미들웨어
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Business Metrics API'
      });
    });

    // 비즈니스 메트릭 개요
    this.app.get('/api/business-metrics/overview', (req, res) => {
      const overview = this.generateBusinessOverview();
      res.json(overview);
    });

    // ROI 계산 결과
    this.app.get('/api/business-metrics/roi', (req, res) => {
      const roiData = this.generateROIData();
      res.json(roiData);
    });

    // 비용 최적화 기회
    this.app.get('/api/business-metrics/cost-optimization', (req, res) => {
      const costOptimization = this.generateCostOptimizationData();
      res.json(costOptimization);
    });

    // SLA 준수 현황
    this.app.get('/api/business-metrics/sla-compliance', (req, res) => {
      const slaData = this.generateSLAData();
      res.json(slaData);
    });

    // 실시간 비즈니스 메트릭
    this.app.get('/api/business-metrics/realtime', (req, res) => {
      const realtimeData = this.generateRealtimeMetrics();
      res.json(realtimeData);
    });

    // 메트릭 히스토리
    this.app.get('/api/business-metrics/history/:metricId', (req, res) => {
      const { metricId } = req.params;
      const { from, to } = req.query;
      const historyData = this.generateMetricHistory(metricId, from, to);
      res.json(historyData);
    });

    // 대시보드 데이터
    this.app.get('/api/business-metrics/dashboard', (req, res) => {
      const dashboardData = this.generateDashboardData();
      res.json(dashboardData);
    });
  }

  generateBusinessOverview() {
    return {
      summary: {
        totalMonthlyCost: 15800000, // 1580만원
        monthlySavings: 3200000,    // 320만원
        roiPercentage: 142.5,
        slaCompliance: 99.2,
        operationalEfficiency: 87.5
      },
      trends: {
        costOptimization: {
          value: 20.3,
          trend: 'improving',
          change: '+3.2%'
        },
        efficiency: {
          value: 87.5,
          trend: 'stable',
          change: '+0.8%'
        },
        compliance: {
          value: 99.2,
          trend: 'stable',
          change: '-0.1%'
        }
      },
      alerts: [
        {
          id: 'high_cpu_cost',
          type: 'cost_optimization',
          severity: 'medium',
          message: 'CPU 사용률이 낮은 서버에서 비용 최적화 기회 발견',
          potentialSavings: 450000
        }
      ]
    };
  }

  generateROIData() {
    return {
      currentROI: {
        percentage: 142.5,
        totalInvestment: 85000000,   // 8500만원
        totalSavings: 121125000,     // 1억 2112만원
        paybackPeriodMonths: 14.2
      },
      scenarios: {
        optimistic: {
          percentage: 178.3,
          totalSavings: 151550000
        },
        realistic: {
          percentage: 142.5,
          totalSavings: 121125000
        },
        pessimistic: {
          percentage: 98.7,
          totalSavings: 83900000
        }
      },
      breakdown: {
        downtimeReduction: {
          savings: 48000000,
          percentage: 39.6
        },
        operationalEfficiency: {
          savings: 36000000,
          percentage: 29.7
        },
        preventiveMaintenance: {
          savings: 18000000,
          percentage: 14.9
        },
        humanResources: {
          savings: 19125000,
          percentage: 15.8
        }
      },
      monthlyTrend: this.generateMonthlyROITrend()
    };
  }

  generateCostOptimizationData() {
    return {
      summary: {
        totalMonthlyCost: 15800000,
        optimizationPotential: 3200000,
        wastedAmount: 1580000,
        efficiencyScore: 87.5
      },
      opportunities: [
        {
          id: 'rightsizing_servers',
          title: '서버 크기 최적화',
          category: 'infrastructure',
          potentialSavings: 1200000,
          implementationCost: 500000,
          roi: 240,
          priority: 'high',
          timeframe: '2-4주',
          riskLevel: 'low'
        },
        {
          id: 'database_optimization',
          title: '데이터베이스 쿼리 최적화',
          category: 'operations',
          potentialSavings: 800000,
          implementationCost: 300000,
          roi: 267,
          priority: 'medium',
          timeframe: '1-2주',
          riskLevel: 'low'
        },
        {
          id: 'storage_tiering',
          title: '스토리지 계층화',
          category: 'infrastructure',
          potentialSavings: 400000,
          implementationCost: 200000,
          roi: 200,
          priority: 'medium',
          timeframe: '3-4주',
          riskLevel: 'medium'
        }
      ],
      resourceUtilization: {
        cpu: { utilization: 65, cost: 2000000, wastedCost: 700000 },
        memory: { utilization: 78, cost: 1500000, wastedCost: 330000 },
        storage: { utilization: 82, cost: 500000, wastedCost: 90000 },
        network: { utilization: 45, cost: 1000000, wastedCost: 550000 }
      }
    };
  }

  generateSLAData() {
    return {
      overview: {
        totalSLAs: 8,
        compliantSLAs: 6,
        atRiskSLAs: 1,
        violatedSLAs: 1,
        overallCompliance: 97.8
      },
      slas: [
        {
          id: 'system_availability',
          name: '시스템 가용성',
          service: 'AIRIS_EPM',
          target: 99.9,
          current: 99.95,
          status: 'compliant',
          trend: 'stable'
        },
        {
          id: 'api_response_time',
          name: 'API 응답 시간',
          service: 'API_Gateway',
          target: 100,
          current: 85,
          status: 'compliant',
          trend: 'improving'
        },
        {
          id: 'incident_resolution_time',
          name: '장애 해결 시간',
          service: 'Support',
          target: 30,
          current: 42,
          status: 'violated',
          trend: 'degrading'
        }
      ],
      recentViolations: [
        {
          id: 'violation_001',
          slaId: 'incident_resolution_time',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2시간 전
          severity: 'major',
          actualValue: 45,
          expectedValue: 30,
          impact: {
            affectedUsers: 150,
            businessLoss: 2500000
          }
        }
      ]
    };
  }

  generateRealtimeMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        businessTransactionValue: {
          value: 15600000, // 시간당 1560만원
          unit: 'KRW/hour',
          change: '+5.2%',
          trend: 'increasing'
        },
        operationalEfficiency: {
          value: 87.5,
          unit: 'percentage',
          change: '+0.8%',
          trend: 'stable'
        },
        costPerTransaction: {
          value: 245,
          unit: 'KRW/transaction',
          change: '-2.1%',
          trend: 'decreasing'
        },
        systemThroughput: {
          value: 1245,
          unit: 'transactions/minute',
          change: '+3.7%',
          trend: 'increasing'
        },
        resourceUtilization: {
          value: 72.3,
          unit: 'percentage',
          change: '+1.5%',
          trend: 'stable'
        }
      }
    };
  }

  generateMetricHistory(metricId, from, to) {
    const startDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();
    const dataPoints = [];
    
    const diffHours = (endDate - startDate) / (1000 * 60 * 60);
    const interval = Math.max(1, Math.floor(diffHours / 24)); // 최대 24개 포인트

    for (let i = 0; i <= diffHours; i += interval) {
      const timestamp = new Date(startDate.getTime() + (i * 60 * 60 * 1000));
      let value;

      switch (metricId) {
        case 'roi_percentage':
          value = 140 + Math.sin(i / 5) * 10 + (Math.random() - 0.5) * 5;
          break;
        case 'cost_optimization':
          value = 20 + Math.cos(i / 3) * 3 + (Math.random() - 0.5) * 2;
          break;
        case 'sla_compliance':
          value = 99 + Math.random() * 1;
          break;
        default:
          value = 50 + Math.random() * 100;
      }

      dataPoints.push({
        timestamp: timestamp.toISOString(),
        value: Math.round(value * 100) / 100
      });
    }

    return {
      metricId,
      period: { from: startDate.toISOString(), to: endDate.toISOString() },
      dataPoints
    };
  }

  generateDashboardData() {
    return {
      kpis: [
        {
          id: 'total_roi',
          name: 'Total ROI',
          value: 142.5,
          unit: '%',
          change: '+8.3%',
          trend: 'improving',
          status: 'excellent'
        },
        {
          id: 'monthly_savings',
          name: '월간 절약액',
          value: 3200000,
          unit: 'KRW',
          change: '+12.5%',
          trend: 'improving',
          status: 'good'
        },
        {
          id: 'sla_compliance',
          name: 'SLA 준수율',
          value: 97.8,
          unit: '%',
          change: '-0.5%',
          trend: 'stable',
          status: 'warning'
        },
        {
          id: 'operational_efficiency',
          name: '운영 효율성',
          value: 87.5,
          unit: '%',
          change: '+2.1%',
          trend: 'improving',
          status: 'good'
        }
      ],
      charts: {
        roiTrend: this.generateMonthlyROITrend(),
        costBreakdown: [
          { category: '인프라', value: 6400000, percentage: 40.5 },
          { category: '운영', value: 4740000, percentage: 30.0 },
          { category: '유지보수', value: 3160000, percentage: 20.0 },
          { category: '기타', value: 1500000, percentage: 9.5 }
        ],
        slaStatus: [
          { status: 'compliant', count: 6, color: '#22c55e' },
          { status: 'at_risk', count: 1, color: '#f59e0b' },
          { status: 'violated', count: 1, color: '#ef4444' }
        ]
      },
      notifications: [
        {
          id: 'notif_001',
          type: 'cost_optimization',
          title: '서버 최적화 기회',
          message: '3대의 서버에서 월 120만원 절약 가능',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          priority: 'medium',
          actionUrl: '/cost-optimization'
        },
        {
          id: 'notif_002',
          type: 'sla_violation',
          title: 'SLA 위반 발생',
          message: '장애 해결 시간이 목표치를 초과했습니다',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          priority: 'high',
          actionUrl: '/sla-monitoring'
        }
      ]
    };
  }

  generateMonthlyROITrend() {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월'];
    const data = [];
    let baseROI = 85;

    months.forEach((month, index) => {
      baseROI += Math.random() * 15 + 5; // 5-20% 증가
      data.push({
        month,
        roi: Math.round(baseROI * 100) / 100,
        investment: 85000000 + (index * 5000000),
        savings: Math.round((85000000 + (index * 5000000)) * (baseROI / 100))
      });
    });

    return data;
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 Business Metrics API Server running on port ${this.port}`);
      console.log(`📊 Available endpoints:`);
      console.log(`   - GET /api/business-metrics/overview`);
      console.log(`   - GET /api/business-metrics/roi`);
      console.log(`   - GET /api/business-metrics/cost-optimization`);
      console.log(`   - GET /api/business-metrics/sla-compliance`);
      console.log(`   - GET /api/business-metrics/realtime`);
      console.log(`   - GET /api/business-metrics/dashboard`);
    });
  }
}

// 서버 시작
if (require.main === module) {
  const server = new BusinessMetricsAPIService(3200);
  server.start();
}

module.exports = BusinessMetricsAPIService;