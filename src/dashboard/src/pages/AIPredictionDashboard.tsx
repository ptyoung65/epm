import React, { useState, useEffect } from 'react';
import { AdvancedChart, ChartSeries } from '../components/charts/AdvancedChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { LoadingSpinner, Skeleton } from '../components/ui/LoadingSpinner';
import PageLayout from '../components/layout/PageLayout';
import { useApiCache, usePerformanceOptimization } from '../hooks/usePerformanceOptimization';
import { 
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Activity,
  Zap,
  Database,
  Cpu,
  DollarSign,
  Users,
  Settings,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';

// AI 예측 데이터 타입 정의
interface PredictionModel {
  id: string;
  name: string;
  type: 'regression' | 'classification' | 'anomaly_detection';
  status: 'training' | 'ready' | 'predicting' | 'error';
  accuracy: number;
  lastTrained: string;
  lastPrediction: string;
  trainingProgress?: number;
  inputFeatures: string[];
  outputTarget: string;
  architecture: string;
}

interface PredictionResult {
  modelId: string;
  prediction: number | number[];
  confidence: number;
  timestamp: string;
  inputData: any;
  explanation?: {
    importantFeatures: Array<{
      feature: string;
      importance: number;
    }>;
    reasoning: string;
  };
}

interface ModelTrainingHistory {
  epoch: number;
  loss: number;
  valLoss: number;
  accuracy?: number;
  valAccuracy?: number;
}

// 샘플 AI 모델 데이터
const sampleModels: PredictionModel[] = [
  {
    id: 'revenue_prediction',
    name: '수익 예측',
    type: 'regression',
    status: 'ready',
    accuracy: 94.2,
    lastTrained: '2024-01-15T10:30:00Z',
    lastPrediction: '2024-01-15T14:45:00Z',
    inputFeatures: ['이전_수익', 'CPU_사용률', '활성_사용자', '계절성', '마케팅_예산'],
    outputTarget: '다음_6시간_수익',
    architecture: 'LSTM'
  },
  {
    id: 'performance_prediction',
    name: '성능 예측',
    type: 'regression',
    status: 'ready',
    accuracy: 91.7,
    lastTrained: '2024-01-15T09:15:00Z',
    lastPrediction: '2024-01-15T14:40:00Z',
    inputFeatures: ['CPU_사용률', '메모리_사용률', '네트워크_IO', '동시_연결수'],
    outputTarget: '응답_시간',
    architecture: 'Neural Network'
  },
  {
    id: 'anomaly_detection',
    name: '이상 탐지',
    type: 'anomaly_detection',
    status: 'predicting',
    accuracy: 96.8,
    lastTrained: '2024-01-15T08:00:00Z',
    lastPrediction: '2024-01-15T14:50:00Z',
    inputFeatures: ['시스템_메트릭', '사용자_행동', '네트워크_패턴'],
    outputTarget: '이상_여부',
    architecture: 'Autoencoder'
  },
  {
    id: 'capacity_planning',
    name: '용량 계획',
    type: 'regression',
    status: 'training',
    accuracy: 88.3,
    lastTrained: '2024-01-15T07:45:00Z',
    lastPrediction: '2024-01-15T12:20:00Z',
    trainingProgress: 67,
    inputFeatures: ['역사적_사용률', '성장_패턴', '계절_요인'],
    outputTarget: '미래_리소스_요구사항',
    architecture: 'CNN-LSTM'
  }
];

// 샘플 예측 결과 생성
const generateSamplePredictions = (modelId: string): PredictionResult[] => {
  const predictions: PredictionResult[] = [];
  const now = new Date();
  
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
    
    let prediction: number | number[];
    let confidence: number;
    
    switch (modelId) {
      case 'revenue_prediction':
        prediction = 50000 + Math.random() * 30000;
        confidence = 0.85 + Math.random() * 0.1;
        break;
      case 'performance_prediction':
        prediction = 100 + Math.random() * 300;
        confidence = 0.90 + Math.random() * 0.08;
        break;
      case 'anomaly_detection':
        prediction = Math.random() < 0.1 ? 1 : 0;
        confidence = 0.92 + Math.random() * 0.07;
        break;
      case 'capacity_planning':
        prediction = [60 + Math.random() * 30, 50 + Math.random() * 40, 40 + Math.random() * 35];
        confidence = 0.88 + Math.random() * 0.10;
        break;
      default:
        prediction = Math.random() * 100;
        confidence = 0.80 + Math.random() * 0.15;
    }
    
    predictions.push({
      modelId,
      prediction,
      confidence,
      timestamp: timestamp.toISOString(),
      inputData: {},
      explanation: {
        importantFeatures: [
          { feature: 'CPU_사용률', importance: 0.35 },
          { feature: '메모리_사용률', importance: 0.28 },
          { feature: '활성_사용자', importance: 0.22 },
          { feature: '시간대', importance: 0.15 }
        ],
        reasoning: `주요 영향 요인은 CPU 사용률(35%)과 메모리 사용률(28%)입니다. 현재 추세를 고려할 때 ${typeof prediction === 'number' ? prediction.toFixed(0) : '정상'} 수준으로 예측됩니다.`
      }
    });
  }
  
  return predictions.reverse();
};

const AIPredictionDashboard: React.FC = () => {
  const [models, setModels] = useState<PredictionModel[]>(sampleModels);
  const [selectedModel, setSelectedModel] = useState<string>('revenue_prediction');
  const [predictions, setPredictions] = useState<Map<string, PredictionResult[]>>(new Map());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);

  const { measureRenderTime } = usePerformanceOptimization();

  // API 데이터 페칭
  const { data: pipelineStatus, loading: pipelineLoading } = useApiCache(
    'pipeline_status',
    async () => {
      const response = await fetch('http://localhost:3400/api/pipeline/status');
      return response.json();
    },
    { ttl: 30000 }
  );

  // 실시간 예측 업데이트
  useEffect(() => {
    // 초기 예측 데이터 로드
    const initialPredictions = new Map();
    models.forEach(model => {
      initialPredictions.set(model.id, generateSamplePredictions(model.id));
    });
    setPredictions(initialPredictions);

    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      setModels(prevModels => 
        prevModels.map(model => {
          if (model.status === 'training' && model.trainingProgress !== undefined) {
            const newProgress = Math.min(100, model.trainingProgress + Math.random() * 5);
            return {
              ...model,
              trainingProgress: newProgress,
              status: newProgress >= 100 ? 'ready' : 'training'
            };
          }
          
          return {
            ...model,
            lastPrediction: new Date().toISOString(),
            accuracy: Math.max(85, Math.min(99, model.accuracy + (Math.random() - 0.5) * 2))
          };
        })
      );

      // 새로운 예측 결과 추가
      setPredictions(prevPredictions => {
        const updated = new Map(prevPredictions);
        models.forEach(model => {
          if (model.status === 'ready' || model.status === 'predicting') {
            const currentPredictions = updated.get(model.id) || [];
            const newPredictions = generateSamplePredictions(model.id).slice(0, 1);
            updated.set(model.id, [...newPredictions, ...currentPredictions].slice(0, 100));
          }
        });
        return updated;
      });
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isAutoRefresh, refreshInterval, models.length]);

  useEffect(() => {
    measureRenderTime();
  });

  // 모델 상태별 아이콘
  const getModelStatusIcon = (status: string, trainingProgress?: number) => {
    switch (status) {
      case 'training':
        return (
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" variant="spinner" />
            <span className="text-xs text-blue-600">{trainingProgress?.toFixed(0)}%</span>
          </div>
        );
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'predicting':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // 모델 유형별 아이콘
  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'regression':
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case 'classification':
        return <Target className="h-5 w-5 text-purple-500" />;
      case 'anomaly_detection':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Brain className="h-5 w-5 text-gray-500" />;
    }
  };

  // 차트 데이터 생성
  const getModelPredictionChart = (modelId: string): ChartSeries[] => {
    const modelPredictions = predictions.get(modelId) || [];
    
    if (modelPredictions.length === 0) return [];

    return [{
      label: '예측값',
      data: modelPredictions.map(p => ({
        x: new Date(p.timestamp).toLocaleTimeString(),
        y: typeof p.prediction === 'number' ? p.prediction : (p.prediction as number[])[0] || 0,
        timestamp: p.timestamp,
        value: typeof p.prediction === 'number' ? p.prediction : (p.prediction as number[])[0] || 0
      }))
    }];
  };

  // 신뢰도 차트 데이터
  const getConfidenceChart = (modelId: string): ChartSeries[] => {
    const modelPredictions = predictions.get(modelId) || [];
    
    return [{
      label: '신뢰도',
      data: modelPredictions.map(p => ({
        x: new Date(p.timestamp).toLocaleTimeString(),
        y: p.confidence * 100,
        timestamp: p.timestamp,
        value: p.confidence * 100
      }))
    }];
  };

  // 특징 중요도 차트
  const getFeatureImportanceChart = (modelId: string): ChartSeries[] => {
    const latestPrediction = predictions.get(modelId)?.[0];
    if (!latestPrediction?.explanation) return [];

    return [{
      label: '특징 중요도',
      data: latestPrediction.explanation.importantFeatures.map(f => ({
        label: f.feature,
        value: f.importance * 100
      }))
    }];
  };

  const selectedModelData = models.find(m => m.id === selectedModel);
  const selectedPredictions = predictions.get(selectedModel) || [];

  return (
    <PageLayout
      title="AI 예측 분석 대시보드"
      subtitle="머신러닝 기반 예측 모델 모니터링 및 결과 분석"
      breadcrumbs={[
        { label: '홈', href: '/' },
        { label: 'AI 예측 분석' }
      ]}
    >
      {/* 전체 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 모델</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{models.filter(m => m.status === 'ready' || m.status === 'predicting').length}</div>
            <p className="text-xs text-muted-foreground">총 {models.length}개 모델</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 정확도</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(models.reduce((sum, m) => sum + m.accuracy, 0) / models.length).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">전체 모델 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예측 수행</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.from(predictions.values()).reduce((sum, preds) => sum + preds.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">지난 24시간</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">데이터 파이프라인</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pipelineLoading ? (
              <Skeleton height={20} width="60%" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">정상</div>
                <p className="text-xs text-muted-foreground">
                  {pipelineStatus?.featureStore?.totalFeatures || 0} 특징 수집
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 모델 목록 및 제어 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI 예측 모델</CardTitle>
              <CardDescription>활성 머신러닝 모델 상태 및 성능</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isAutoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                className="gap-2"
              >
                {isAutoRefresh ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                {isAutoRefresh ? '자동 새로고침' : '새로고침 중단'}
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                설정
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {models.map((model) => (
              <Card 
                key={model.id}
                className={`cursor-pointer transition-all border ${
                  selectedModel === model.id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedModel(model.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getModelTypeIcon(model.type)}
                      <div>
                        <CardTitle className="text-sm font-medium">{model.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {model.architecture}
                        </CardDescription>
                      </div>
                    </div>
                    {getModelStatusIcon(model.status, model.trainingProgress)}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>정확도</span>
                      <span className="font-medium">{model.accuracy.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${model.accuracy}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>마지막 훈련</span>
                      <span>{new Date(model.lastTrained).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 선택된 모델 상세 분석 */}
      {selectedModelData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getModelTypeIcon(selectedModelData.type)}
              {selectedModelData.name} - 상세 분석
            </CardTitle>
            <CardDescription>
              {selectedModelData.inputFeatures.length}개 입력 특징 → {selectedModelData.outputTarget}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="predictions" className="space-y-4">
              <TabsList>
                <TabsTrigger value="predictions">예측 결과</TabsTrigger>
                <TabsTrigger value="performance">성능 분석</TabsTrigger>
                <TabsTrigger value="features">특징 중요도</TabsTrigger>
                <TabsTrigger value="training">훈련 이력</TabsTrigger>
              </TabsList>

              <TabsContent value="predictions" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AdvancedChart
                    type="line"
                    title="예측값 추이"
                    description="최근 24시간 예측 결과"
                    series={getModelPredictionChart(selectedModel)}
                    height={300}
                    realTime={isAutoRefresh}
                    gradient={true}
                    showGrid={true}
                    animate={true}
                  />

                  <AdvancedChart
                    type="line"
                    title="예측 신뢰도"
                    description="모델 예측의 신뢰도 수준"
                    series={getConfidenceChart(selectedModel)}
                    height={300}
                    realTime={isAutoRefresh}
                    showGrid={true}
                    threshold={{
                      value: 80,
                      label: '최소 신뢰도',
                      color: '#F59E0B'
                    }}
                  />
                </div>

                {/* 최근 예측 결과 테이블 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">최근 예측 결과</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <div className="grid grid-cols-4 gap-4 p-3 bg-gray-50 font-medium text-sm">
                      <div>시간</div>
                      <div>예측값</div>
                      <div>신뢰도</div>
                      <div>설명</div>
                    </div>
                    {selectedPredictions.slice(0, 5).map((prediction, index) => (
                      <div key={index} className="grid grid-cols-4 gap-4 p-3 border-t text-sm">
                        <div>{new Date(prediction.timestamp).toLocaleTimeString('ko-KR')}</div>
                        <div className="font-medium">
                          {typeof prediction.prediction === 'number' 
                            ? prediction.prediction.toLocaleString() 
                            : Array.isArray(prediction.prediction) 
                              ? prediction.prediction.map(p => p.toFixed(1)).join(', ')
                              : '-'}
                        </div>
                        <div>
                          <Badge 
                            variant={prediction.confidence > 0.9 ? "default" : prediction.confidence > 0.8 ? "secondary" : "destructive"}
                            className="text-xs"
                          >
                            {(prediction.confidence * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {prediction.explanation?.reasoning.slice(0, 50) || '-'}...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">모델 정확도</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">
                        {selectedModelData.accuracy.toFixed(1)}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${selectedModelData.accuracy}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">평균 신뢰도</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">
                        {selectedPredictions.length > 0 
                          ? (selectedPredictions.reduce((sum, p) => sum + p.confidence, 0) / selectedPredictions.length * 100).toFixed(1)
                          : '0.0'}%
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">예측 횟수</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-purple-600">
                        {selectedPredictions.length}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">지난 24시간</p>
                    </CardContent>
                  </Card>
                </div>

                {/* 성능 메트릭 차트 */}
                <AdvancedChart
                  type="radar"
                  title="모델 성능 메트릭"
                  description="다양한 성능 지표 종합 평가"
                  series={[{
                    label: selectedModelData.name,
                    data: [
                      { label: '정확도', value: selectedModelData.accuracy },
                      { label: '신뢰도', value: selectedPredictions.length > 0 ? selectedPredictions.reduce((sum, p) => sum + p.confidence, 0) / selectedPredictions.length * 100 : 0 },
                      { label: '안정성', value: 88 },
                      { label: '속도', value: 92 },
                      { label: '해석가능성', value: 75 },
                      { label: '일반화', value: 85 }
                    ]
                  }]}
                  height={350}
                  showLegend={true}
                />
              </TabsContent>

              <TabsContent value="features" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AdvancedChart
                    type="bar"
                    title="특징 중요도"
                    description="예측에 가장 영향을 미치는 특징들"
                    series={getFeatureImportanceChart(selectedModel)}
                    height={300}
                    showGrid={true}
                  />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">입력 특징 목록</h3>
                    <div className="space-y-2">
                      {selectedModelData.inputFeatures.map((feature, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium">{feature}</span>
                          <Badge variant="outline" className="text-xs">
                            {selectedPredictions[0]?.explanation?.importantFeatures
                              .find(f => f.feature === feature)?.importance 
                              ? (selectedPredictions[0].explanation.importantFeatures
                                  .find(f => f.feature === feature)!.importance * 100).toFixed(1) + '%'
                              : 'N/A'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 최근 예측 설명 */}
                {selectedPredictions[0]?.explanation && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">최근 예측 설명</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {selectedPredictions[0].explanation.reasoning}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="training" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">훈련 정보</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>마지막 훈련</span>
                        <span className="font-medium">
                          {new Date(selectedModelData.lastTrained).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>아키텍처</span>
                        <span className="font-medium">{selectedModelData.architecture}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>모델 타입</span>
                        <Badge variant="outline">{selectedModelData.type}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>상태</span>
                        <Badge variant={
                          selectedModelData.status === 'ready' ? 'default' :
                          selectedModelData.status === 'training' ? 'secondary' :
                          selectedModelData.status === 'predicting' ? 'default' : 'destructive'
                        }>
                          {selectedModelData.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">모델 작업</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button className="w-full gap-2" disabled={selectedModelData.status === 'training'}>
                        <RefreshCw className="h-4 w-4" />
                        모델 재훈련
                      </Button>
                      <Button variant="outline" className="w-full gap-2">
                        <Download className="h-4 w-4" />
                        모델 내보내기
                      </Button>
                      <Button variant="outline" className="w-full gap-2">
                        <Upload className="h-4 w-4" />
                        모델 가져오기
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* 훈련 히스토리 차트 */}
                <AdvancedChart
                  type="line"
                  title="훈련 히스토리"
                  description="에포크별 손실 및 정확도 변화"
                  series={[
                    {
                      label: '훈련 손실',
                      data: Array.from({ length: 50 }, (_, i) => ({
                        x: `Epoch ${i + 1}`,
                        y: 0.5 * Math.exp(-i * 0.05) + Math.random() * 0.1,
                        value: 0.5 * Math.exp(-i * 0.05) + Math.random() * 0.1
                      }))
                    },
                    {
                      label: '검증 손실',
                      data: Array.from({ length: 50 }, (_, i) => ({
                        x: `Epoch ${i + 1}`,
                        y: 0.6 * Math.exp(-i * 0.04) + Math.random() * 0.15,
                        value: 0.6 * Math.exp(-i * 0.04) + Math.random() * 0.15
                      }))
                    }
                  ]}
                  height={300}
                  showGrid={true}
                  showLegend={true}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
};

export default AIPredictionDashboard;