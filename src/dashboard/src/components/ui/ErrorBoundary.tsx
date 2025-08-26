import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      errorInfo
    });

    // 에러 로깅 서비스로 전송
    this.logErrorToService(error, errorInfo);
    
    // 부모 컴포넌트의 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // 실제 구현에서는 에러 로깅 서비스 (Sentry, LogRocket 등)로 전송
    const errorData = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: 'current-user-id' // 실제 사용자 ID로 교체
    };

    // 콘솔에 로깅 (실제로는 외부 서비스로 전송)
    console.error('Error logged:', errorData);

    // 서버로 에러 리포트 전송 (예시)
    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData),
    }).catch(err => {
      console.error('Failed to log error to server:', err);
    });
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      copied: false
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private copyErrorDetails = async () => {
    if (!this.state.error || !this.state.errorInfo) return;

    const errorDetails = `
Error ID: ${this.state.errorId}
Error Message: ${this.state.error.message}
Stack Trace: ${this.state.error.stack}
Component Stack: ${this.state.errorInfo.componentStack}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      // 사용자 정의 fallback이 있는 경우 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                앗! 문제가 발생했습니다
              </CardTitle>
              <CardDescription className="text-lg">
                예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* 에러 ID */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">오류 ID</p>
                    <p className="text-lg font-mono text-gray-900">{this.state.errorId}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.copyErrorDetails}
                    className="gap-2"
                  >
                    {this.state.copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        세부정보 복사
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={this.handleRetry}
                  className="flex-1 gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  다시 시도
                </Button>
                <Button 
                  variant="outline"
                  onClick={this.handleReload}
                  className="flex-1 gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  페이지 새로고침
                </Button>
                <Button 
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex-1 gap-2"
                >
                  <Home className="w-4 h-4" />
                  홈으로 이동
                </Button>
              </div>

              {/* 에러 상세 정보 (개발 모드에서만 또는 showErrorDetails가 true일 때) */}
              {(this.props.showErrorDetails || process.env.NODE_ENV === 'development') && (
                <details className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <summary className="cursor-pointer font-medium text-red-800 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    개발자 정보 (디버깅용)
                  </summary>
                  <div className="mt-4 space-y-4">
                    {this.state.error && (
                      <div>
                        <h4 className="font-medium text-red-800">에러 메시지:</h4>
                        <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto">
                          {this.state.error.message}
                        </pre>
                      </div>
                    )}
                    
                    {this.state.error?.stack && (
                      <div>
                        <h4 className="font-medium text-red-800">스택 트레이스:</h4>
                        <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-40">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <h4 className="font-medium text-red-800">컴포넌트 스택:</h4>
                        <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-40">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* 도움말 텍스트 */}
              <div className="text-center text-sm text-gray-600">
                <p>
                  문제가 지속되면 관리자에게 <strong>오류 ID</strong>와 함께 문의해주세요.
                </p>
                <p className="mt-1">
                  이메일: <a href="mailto:support@company.com" className="text-blue-600 hover:underline">
                    support@company.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// 함수형 컴포넌트를 위한 withErrorBoundary HOC
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  return (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

// 에러 리포팅 훅
export const useErrorReporting = () => {
  const reportError = React.useCallback((error: Error, context?: string) => {
    console.error('Manual error report:', error, context);
    
    // 에러 로깅 서비스로 전송
    const errorData = {
      errorId: `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      context: context || 'Manual report',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData),
    }).catch(err => {
      console.error('Failed to report error:', err);
    });
  }, []);

  return { reportError };
};

export default ErrorBoundary;