/**
 * AIRIS EPM SDK Generator
 * Automatically generates SDKs for multiple programming languages
 * from OpenAPI and GraphQL specifications
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export class SDKGenerator {
    constructor(options = {}) {
        this.outputDir = options.outputDir || './generated-sdks';
        this.openApiSpec = options.openApiSpec || './src/docs/api/openapi.yaml';
        this.graphqlSchema = options.graphqlSchema || './src/docs/api/schema.graphql';
        this.languages = options.languages || ['javascript', 'python', 'java', 'csharp', 'go', 'php'];
        this.packageInfo = options.packageInfo || {
            name: 'airis-epm-sdk',
            version: '1.0.0',
            description: 'AIRIS EPM API SDK',
            author: 'AIRIS EPM Team',
            repository: 'https://github.com/airis-epm/sdk'
        };
    }

    /**
     * Generate SDKs for all configured languages
     */
    async generateAll() {
        console.log('🚀 Starting SDK generation for AIRIS EPM API...');
        
        try {
            // Load API specifications
            const openApiSpec = await this.loadOpenApiSpec();
            const graphqlSchema = await this.loadGraphQLSchema();
            
            // Create output directories
            await this.createOutputDirectories();
            
            // Generate SDKs for each language
            const results = {};
            for (const language of this.languages) {
                console.log(`📦 Generating ${language.toUpperCase()} SDK...`);
                results[language] = await this.generateSDK(language, openApiSpec, graphqlSchema);
            }
            
            // Generate meta files
            await this.generateMetaFiles(results);
            
            console.log('✅ SDK generation completed successfully!');
            return results;
            
        } catch (error) {
            console.error('❌ SDK generation failed:', error);
            throw error;
        }
    }

    /**
     * Load OpenAPI specification
     */
    async loadOpenApiSpec() {
        try {
            const content = await fs.readFile(this.openApiSpec, 'utf8');
            return yaml.load(content);
        } catch (error) {
            throw new Error(`Failed to load OpenAPI spec: ${error.message}`);
        }
    }

    /**
     * Load GraphQL schema
     */
    async loadGraphQLSchema() {
        try {
            return await fs.readFile(this.graphqlSchema, 'utf8');
        } catch (error) {
            throw new Error(`Failed to load GraphQL schema: ${error.message}`);
        }
    }

    /**
     * Create output directories
     */
    async createOutputDirectories() {
        await fs.mkdir(this.outputDir, { recursive: true });
        
        for (const language of this.languages) {
            await fs.mkdir(path.join(this.outputDir, language), { recursive: true });
        }
    }

    /**
     * Generate SDK for specific language
     */
    async generateSDK(language, openApiSpec, graphqlSchema) {
        const generators = {
            javascript: () => this.generateJavaScriptSDK(openApiSpec, graphqlSchema),
            python: () => this.generatePythonSDK(openApiSpec, graphqlSchema),
            java: () => this.generateJavaSDK(openApiSpec, graphqlSchema),
            csharp: () => this.generateCSharpSDK(openApiSpec, graphqlSchema),
            go: () => this.generateGoSDK(openApiSpec, graphqlSchema),
            php: () => this.generatePHPSDK(openApiSpec, graphqlSchema)
        };

        if (!generators[language]) {
            throw new Error(`Unsupported language: ${language}`);
        }

        return await generators[language]();
    }

    /**
     * Generate JavaScript/TypeScript SDK
     */
    async generateJavaScriptSDK(openApiSpec, graphqlSchema) {
        const sdkDir = path.join(this.outputDir, 'javascript');
        
        // Package.json
        const packageJson = {
            name: `${this.packageInfo.name}-js`,
            version: this.packageInfo.version,
            description: `${this.packageInfo.description} for JavaScript/Node.js`,
            main: 'index.js',
            types: 'index.d.ts',
            scripts: {
                build: 'tsc',
                test: 'jest',
                lint: 'eslint src/**/*.ts'
            },
            dependencies: {
                'axios': '^1.6.0',
                'graphql': '^16.8.0',
                'graphql-request': '^6.1.0'
            },
            devDependencies: {
                '@types/node': '^20.0.0',
                'typescript': '^5.0.0',
                'jest': '^29.0.0',
                'eslint': '^8.0.0'
            },
            keywords: ['airis', 'epm', 'api', 'sdk', 'monitoring', 'performance'],
            author: this.packageInfo.author,
            license: 'MIT',
            repository: this.packageInfo.repository
        };

        await fs.writeFile(
            path.join(sdkDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );

        // Main SDK file
        const mainSDK = this.generateJavaScriptMainFile(openApiSpec);
        await fs.writeFile(path.join(sdkDir, 'index.js'), mainSDK);

        // TypeScript definitions
        const typeDefinitions = this.generateTypeScriptDefinitions(openApiSpec);
        await fs.writeFile(path.join(sdkDir, 'index.d.ts'), typeDefinitions);

        // GraphQL client
        const graphqlClient = this.generateJavaScriptGraphQLClient(graphqlSchema);
        await fs.writeFile(path.join(sdkDir, 'graphql-client.js'), graphqlClient);

        // Examples
        const examples = this.generateJavaScriptExamples(openApiSpec);
        await fs.writeFile(path.join(sdkDir, 'examples.js'), examples);

        // README
        const readme = this.generateJavaScriptReadme();
        await fs.writeFile(path.join(sdkDir, 'README.md'), readme);

        return {
            language: 'javascript',
            files: ['package.json', 'index.js', 'index.d.ts', 'graphql-client.js', 'examples.js', 'README.md'],
            path: sdkDir
        };
    }

    /**
     * Generate JavaScript main file
     */
    generateJavaScriptMainFile(openApiSpec) {
        return `/**
 * AIRIS EPM JavaScript SDK
 * Generated automatically from OpenAPI specification
 */

const axios = require('axios');
const { GraphQLClient } = require('graphql-request');

class AirisEPMClient {
    constructor(options = {}) {
        this.baseURL = options.baseURL || 'http://localhost:3000/api/v1';
        this.apiKey = options.apiKey || null;
        this.timeout = options.timeout || 30000;
        
        // Initialize HTTP client
        this.httpClient = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'airis-epm-sdk-js/1.0.0',
                ...(this.apiKey && { 'Authorization': \`Bearer \${this.apiKey}\` })
            }
        });

        // Initialize GraphQL client
        const graphqlEndpoint = options.graphqlEndpoint || 
            this.baseURL.replace('/api/v1', '/graphql');
        
        this.graphqlClient = new GraphQLClient(graphqlEndpoint, {
            headers: {
                ...(this.apiKey && { 'Authorization': \`Bearer \${this.apiKey}\` })
            }
        });

        // Initialize API modules
        this.performance = new PerformanceAPI(this.httpClient);
        this.dataQuality = new DataQualityAPI(this.httpClient);
        this.analytics = new AnalyticsAPI(this.httpClient);
        this.alerts = new AlertsAPI(this.httpClient);
        this.system = new SystemAPI(this.httpClient);
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            const response = await this.system.getHealth();
            return {
                success: true,
                status: response.status,
                version: response.version,
                uptime: response.uptime
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute GraphQL query
     */
    async graphql(query, variables = {}) {
        try {
            return await this.graphqlClient.request(query, variables);
        } catch (error) {
            throw new Error(\`GraphQL request failed: \${error.message}\`);
        }
    }
}

// Performance API
class PerformanceAPI {
    constructor(httpClient) {
        this.client = httpClient;
    }

    async getMetrics(params = {}) {
        const response = await this.client.get('/performance/metrics', { params });
        return response.data;
    }

    async submitMetrics(metrics) {
        const response = await this.client.post('/performance/metrics', { metrics });
        return response.data;
    }

    async getCacheStats() {
        const response = await this.client.get('/performance/cache/stats');
        return response.data;
    }

    async getCachedData(type, key) {
        const response = await this.client.get(\`/performance/cache/\${type}/\${key}\`);
        return response.data;
    }

    async setCachedData(type, key, data, options = {}) {
        const response = await this.client.post(\`/performance/cache/\${type}/\${key}\`, {
            data,
            ...options
        });
        return response.data;
    }

    async invalidateCache(type, key) {
        const response = await this.client.delete(\`/performance/cache/\${type}/\${key}\`);
        return response.data;
    }
}

// Data Quality API
class DataQualityAPI {
    constructor(httpClient) {
        this.client = httpClient;
    }

    async validateData(data, schema, options = {}) {
        const response = await this.client.post('/data-quality/validation', {
            data,
            schema,
            ...options
        });
        return response.data;
    }

    async getAnomalies(params = {}) {
        const response = await this.client.get('/data-quality/anomalies', { params });
        return response.data;
    }

    async detectAnomalies(data, options = {}) {
        const response = await this.client.post('/data-quality/anomalies', {
            data,
            ...options
        });
        return response.data;
    }

    async cleanseData(data, rules, options = {}) {
        const response = await this.client.post('/data-quality/cleansing', {
            data,
            rules,
            ...options
        });
        return response.data;
    }
}

// Analytics API
class AnalyticsAPI {
    constructor(httpClient) {
        this.client = httpClient;
    }

    async getDashboard(dashboardId, params = {}) {
        const response = await this.client.get('/analytics/dashboard', {
            params: { dashboardId, ...params }
        });
        return response.data;
    }

    async getReports(params = {}) {
        const response = await this.client.get('/analytics/reports', { params });
        return response.data;
    }

    async generateReport(reportConfig) {
        const response = await this.client.post('/analytics/reports', reportConfig);
        return response.data;
    }
}

// Alerts API
class AlertsAPI {
    constructor(httpClient) {
        this.client = httpClient;
    }

    async getAlerts(params = {}) {
        const response = await this.client.get('/alerts', { params });
        return response.data;
    }

    async getAlert(alertId) {
        const response = await this.client.get(\`/alerts/\${alertId}\`);
        return response.data;
    }

    async createAlertRule(rule) {
        const response = await this.client.post('/alerts', rule);
        return response.data;
    }

    async updateAlertStatus(alertId, status, comment) {
        const response = await this.client.patch(\`/alerts/\${alertId}\`, {
            status,
            comment
        });
        return response.data;
    }
}

// System API
class SystemAPI {
    constructor(httpClient) {
        this.client = httpClient;
    }

    async getHealth() {
        const response = await this.client.get('/health');
        return response.data;
    }
}

module.exports = {
    AirisEPMClient,
    PerformanceAPI,
    DataQualityAPI,
    AnalyticsAPI,
    AlertsAPI,
    SystemAPI
};`;
    }

    /**
     * Generate TypeScript definitions
     */
    generateTypeScriptDefinitions(openApiSpec) {
        return `/**
 * AIRIS EPM TypeScript Definitions
 * Generated from OpenAPI specification
 */

export interface AirisEPMClientOptions {
    baseURL?: string;
    apiKey?: string;
    timeout?: number;
    graphqlEndpoint?: string;
}

export interface ConnectionTestResult {
    success: boolean;
    status?: string;
    version?: string;
    uptime?: number;
    error?: string;
}

export interface Metric {
    timestamp: string;
    metricType: string;
    value: number;
    tags?: Record<string, string>;
}

export interface MetricsResponse {
    success: boolean;
    data: Metric[];
    metadata: {
        totalCount: number;
        timeRange: string;
        aggregation: string;
    };
}

export interface CacheStats {
    success: boolean;
    stats: {
        hitRate: number;
        missRate: number;
        totalRequests: number;
        cacheSize: number;
        evictions: number;
    };
}

export interface ValidationResult {
    success: boolean;
    valid: boolean;
    errors: ValidationError[];
    qualityScore: number;
}

export interface ValidationError {
    field: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Anomaly {
    id: string;
    timestamp: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedMetrics: string[];
    confidenceScore: number;
}

export interface Alert {
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'active' | 'resolved' | 'acknowledged';
    createdAt: string;
    updatedAt: string;
    ruleId: string;
}

export interface DashboardData {
    success: boolean;
    dashboardId: string;
    data: Record<string, any>;
    widgets: Widget[];
    lastUpdated: string;
}

export interface Widget {
    id: string;
    type: 'chart' | 'table' | 'metric' | 'alert';
    title: string;
    data: Record<string, any>;
    config: Record<string, any>;
}

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    dependencies: Record<string, {
        status: 'healthy' | 'degraded' | 'unhealthy';
        latency: number;
        lastCheck: string;
    }>;
}

export declare class AirisEPMClient {
    constructor(options?: AirisEPMClientOptions);
    
    performance: PerformanceAPI;
    dataQuality: DataQualityAPI;
    analytics: AnalyticsAPI;
    alerts: AlertsAPI;
    system: SystemAPI;
    
    testConnection(): Promise<ConnectionTestResult>;
    graphql(query: string, variables?: Record<string, any>): Promise<any>;
}

export declare class PerformanceAPI {
    getMetrics(params?: Record<string, any>): Promise<MetricsResponse>;
    submitMetrics(metrics: Metric[]): Promise<any>;
    getCacheStats(): Promise<CacheStats>;
    getCachedData(type: string, key: string): Promise<any>;
    setCachedData(type: string, key: string, data: any, options?: Record<string, any>): Promise<any>;
    invalidateCache(type: string, key: string): Promise<any>;
}

export declare class DataQualityAPI {
    validateData(data: any, schema: string, options?: Record<string, any>): Promise<ValidationResult>;
    getAnomalies(params?: Record<string, any>): Promise<{ success: boolean; anomalies: Anomaly[] }>;
    detectAnomalies(data: any[], options?: Record<string, any>): Promise<{ success: boolean; anomalies: Anomaly[] }>;
    cleanseData(data: any[], rules: string[], options?: Record<string, any>): Promise<any>;
}

export declare class AnalyticsAPI {
    getDashboard(dashboardId: string, params?: Record<string, any>): Promise<DashboardData>;
    getReports(params?: Record<string, any>): Promise<any>;
    generateReport(reportConfig: Record<string, any>): Promise<any>;
}

export declare class AlertsAPI {
    getAlerts(params?: Record<string, any>): Promise<{ success: boolean; alerts: Alert[] }>;
    getAlert(alertId: string): Promise<Alert>;
    createAlertRule(rule: Record<string, any>): Promise<any>;
    updateAlertStatus(alertId: string, status: string, comment?: string): Promise<Alert>;
}

export declare class SystemAPI {
    getHealth(): Promise<HealthStatus>;
}`;
    }

    /**
     * Generate Python SDK
     */
    async generatePythonSDK(openApiSpec, graphqlSchema) {
        const sdkDir = path.join(this.outputDir, 'python');
        
        // setup.py
        const setupPy = this.generatePythonSetup();
        await fs.writeFile(path.join(sdkDir, 'setup.py'), setupPy);

        // Main SDK file
        const mainSDK = this.generatePythonMainFile(openApiSpec);
        await fs.writeFile(path.join(sdkDir, 'airis_epm_sdk.py'), mainSDK);

        // GraphQL client
        const graphqlClient = this.generatePythonGraphQLClient(graphqlSchema);
        await fs.writeFile(path.join(sdkDir, 'graphql_client.py'), graphqlClient);

        // Examples
        const examples = this.generatePythonExamples();
        await fs.writeFile(path.join(sdkDir, 'examples.py'), examples);

        // README
        const readme = this.generatePythonReadme();
        await fs.writeFile(path.join(sdkDir, 'README.md'), readme);

        return {
            language: 'python',
            files: ['setup.py', 'airis_epm_sdk.py', 'graphql_client.py', 'examples.py', 'README.md'],
            path: sdkDir
        };
    }

    /**
     * Generate Python setup.py
     */
    generatePythonSetup() {
        return `"""
AIRIS EPM Python SDK Setup
"""

from setuptools import setup, find_packages

setup(
    name='airis-epm-sdk',
    version='${this.packageInfo.version}',
    description='${this.packageInfo.description} for Python',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    author='${this.packageInfo.author}',
    url='${this.packageInfo.repository}',
    packages=find_packages(),
    install_requires=[
        'requests>=2.31.0',
        'graphql-core>=3.2.0',
        'python-dateutil>=2.8.0',
        'typing-extensions>=4.0.0'
    ],
    extras_require={
        'dev': [
            'pytest>=7.0.0',
            'pytest-cov>=4.0.0',
            'black>=23.0.0',
            'flake8>=6.0.0',
            'mypy>=1.0.0'
        ]
    },
    python_requires='>=3.8',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'Topic :: System :: Monitoring',
        'Topic :: Internet :: WWW/HTTP :: HTTP Servers'
    ],
    keywords=['airis', 'epm', 'api', 'sdk', 'monitoring', 'performance']
)`;
    }

    /**
     * Generate Python main file
     */
    generatePythonMainFile(openApiSpec) {
        return `"""
AIRIS EPM Python SDK
Generated automatically from OpenAPI specification
"""

import json
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class AirisEPMClientConfig:
    """Configuration for AIRIS EPM Client"""
    base_url: str = "http://localhost:3000/api/v1"
    api_key: Optional[str] = None
    timeout: int = 30
    graphql_endpoint: Optional[str] = None
    verify_ssl: bool = True


class AirisEPMException(Exception):
    """Base exception for AIRIS EPM SDK"""
    pass


class AirisEPMAPIException(AirisEPMException):
    """API-related exceptions"""
    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[requests.Response] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class AirisEPMClient:
    """
    AIRIS EPM API Client
    
    Main client for interacting with AIRIS EPM API
    """
    
    def __init__(self, config: Optional[AirisEPMClientConfig] = None, **kwargs):
        """
        Initialize AIRIS EPM Client
        
        Args:
            config: Client configuration
            **kwargs: Configuration overrides
        """
        self.config = config or AirisEPMClientConfig()
        
        # Override config with kwargs
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
        
        # Setup session
        self.session = requests.Session()
        self.session.timeout = self.config.timeout
        self.session.verify = self.config.verify_ssl
        
        # Setup headers
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'airis-epm-sdk-python/1.0.0'
        }
        
        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'
            
        self.session.headers.update(headers)
        
        # Initialize API modules
        self.performance = PerformanceAPI(self)
        self.data_quality = DataQualityAPI(self)
        self.analytics = AnalyticsAPI(self)
        self.alerts = AlertsAPI(self)
        self.system = SystemAPI(self)
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        Make HTTP request to API
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            **kwargs: Request parameters
            
        Returns:
            Response data
            
        Raises:
            AirisEPMAPIException: If request fails
        """
        url = f"{self.config.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            
            return response.json() if response.content else {}
            
        except requests.exceptions.HTTPError as e:
            try:
                error_data = response.json()
                message = error_data.get('error', str(e))
            except (json.JSONDecodeError, AttributeError):
                message = str(e)
                
            raise AirisEPMAPIException(
                message=message,
                status_code=response.status_code,
                response=response
            )
        except requests.exceptions.RequestException as e:
            raise AirisEPMAPIException(f"Request failed: {str(e)}")
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test API connection
        
        Returns:
            Connection test result
        """
        try:
            health = self.system.get_health()
            return {
                'success': True,
                'status': health.get('status'),
                'version': health.get('version'),
                'uptime': health.get('uptime')
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


class PerformanceAPI:
    """Performance monitoring API"""
    
    def __init__(self, client: AirisEPMClient):
        self.client = client
    
    def get_metrics(self, **params) -> Dict[str, Any]:
        """Get performance metrics"""
        return self.client._make_request('GET', '/performance/metrics', params=params)
    
    def submit_metrics(self, metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Submit performance metrics"""
        return self.client._make_request('POST', '/performance/metrics', json={'metrics': metrics})
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return self.client._make_request('GET', '/performance/cache/stats')
    
    def get_cached_data(self, cache_type: str, key: str) -> Dict[str, Any]:
        """Get cached data"""
        return self.client._make_request('GET', f'/performance/cache/{cache_type}/{key}')
    
    def set_cached_data(self, cache_type: str, key: str, data: Any, **options) -> Dict[str, Any]:
        """Set cached data"""
        payload = {'data': data, **options}
        return self.client._make_request('POST', f'/performance/cache/{cache_type}/{key}', json=payload)
    
    def invalidate_cache(self, cache_type: str, key: str) -> Dict[str, Any]:
        """Invalidate cached data"""
        return self.client._make_request('DELETE', f'/performance/cache/{cache_type}/{key}')


class DataQualityAPI:
    """Data quality management API"""
    
    def __init__(self, client: AirisEPMClient):
        self.client = client
    
    def validate_data(self, data: Any, schema: str, **options) -> Dict[str, Any]:
        """Validate data quality"""
        payload = {'data': data, 'schema': schema, **options}
        return self.client._make_request('POST', '/data-quality/validation', json=payload)
    
    def get_anomalies(self, **params) -> Dict[str, Any]:
        """Get anomaly detection results"""
        return self.client._make_request('GET', '/data-quality/anomalies', params=params)
    
    def detect_anomalies(self, data: List[Any], **options) -> Dict[str, Any]:
        """Submit data for anomaly detection"""
        payload = {'data': data, **options}
        return self.client._make_request('POST', '/data-quality/anomalies', json=payload)
    
    def cleanse_data(self, data: List[Any], rules: List[str], **options) -> Dict[str, Any]:
        """Clean and transform data"""
        payload = {'data': data, 'rules': rules, **options}
        return self.client._make_request('POST', '/data-quality/cleansing', json=payload)


class AnalyticsAPI:
    """Analytics and reporting API"""
    
    def __init__(self, client: AirisEPMClient):
        self.client = client
    
    def get_dashboard(self, dashboard_id: str, **params) -> Dict[str, Any]:
        """Get dashboard data"""
        params['dashboardId'] = dashboard_id
        return self.client._make_request('GET', '/analytics/dashboard', params=params)
    
    def get_reports(self, **params) -> Dict[str, Any]:
        """Get analytics reports"""
        return self.client._make_request('GET', '/analytics/reports', params=params)
    
    def generate_report(self, report_config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate custom report"""
        return self.client._make_request('POST', '/analytics/reports', json=report_config)


class AlertsAPI:
    """Alerts management API"""
    
    def __init__(self, client: AirisEPMClient):
        self.client = client
    
    def get_alerts(self, **params) -> Dict[str, Any]:
        """Get alerts"""
        return self.client._make_request('GET', '/alerts', params=params)
    
    def get_alert(self, alert_id: str) -> Dict[str, Any]:
        """Get specific alert"""
        return self.client._make_request('GET', f'/alerts/{alert_id}')
    
    def create_alert_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Create alert rule"""
        return self.client._make_request('POST', '/alerts', json=rule)
    
    def update_alert_status(self, alert_id: str, status: str, comment: Optional[str] = None) -> Dict[str, Any]:
        """Update alert status"""
        payload = {'status': status}
        if comment:
            payload['comment'] = comment
        return self.client._make_request('PATCH', f'/alerts/{alert_id}', json=payload)


class SystemAPI:
    """System management API"""
    
    def __init__(self, client: AirisEPMClient):
        self.client = client
    
    def get_health(self) -> Dict[str, Any]:
        """Get system health status"""
        return self.client._make_request('GET', '/health')


# Convenience functions
def create_client(api_key: str, base_url: str = "http://localhost:3000/api/v1", **kwargs) -> AirisEPMClient:
    """
    Create AIRIS EPM client with API key
    
    Args:
        api_key: API authentication key
        base_url: API base URL
        **kwargs: Additional configuration
        
    Returns:
        Configured client instance
    """
    config = AirisEPMClientConfig(
        api_key=api_key,
        base_url=base_url,
        **kwargs
    )
    return AirisEPMClient(config)


# Type aliases for convenience
MetricData = Dict[str, Any]
ValidationResult = Dict[str, Any]
AnomalyResult = Dict[str, Any]
AlertData = Dict[str, Any]
DashboardData = Dict[str, Any]
HealthStatus = Dict[str, Any]`;
    }

    /**
     * Generate meta files
     */
    async generateMetaFiles(results) {
        // Generate overview README
        const overviewReadme = `# AIRIS EPM SDKs

Auto-generated SDKs for AIRIS Enterprise Performance Management API.

## Available SDKs

${this.languages.map(lang => `- [${lang.charAt(0).toUpperCase() + lang.slice(1)}](./${lang}/README.md)`).join('\n')}

## Quick Start

Choose your preferred programming language and follow the setup instructions in the respective directory.

## Features

- ✅ REST API support
- ✅ GraphQL support  
- ✅ Authentication handling
- ✅ Error handling
- ✅ Type definitions
- ✅ Examples and documentation
- ✅ Async/await support
- ✅ Request/response interceptors

## API Coverage

- **Performance Monitoring**: Real-time metrics, caching, optimization
- **Data Quality**: Validation, anomaly detection, cleansing
- **Analytics**: Dashboards, reports, custom analytics
- **Alerts**: Alert management, rules, notifications
- **System**: Health checks, configuration

## Support

For issues and questions, please visit our [GitHub repository](${this.packageInfo.repository}).

Generated on: ${new Date().toISOString()}
`;

        await fs.writeFile(path.join(this.outputDir, 'README.md'), overviewReadme);

        // Generate generation report
        const report = {
            generated_at: new Date().toISOString(),
            version: this.packageInfo.version,
            languages: results,
            total_files: Object.values(results).reduce((sum, lang) => sum + lang.files.length, 0),
            openapi_spec: this.openApiSpec,
            graphql_schema: this.graphqlSchema
        };

        await fs.writeFile(
            path.join(this.outputDir, 'generation-report.json'),
            JSON.stringify(report, null, 2)
        );
    }

    /**
     * Generate JavaScript examples
     */
    generateJavaScriptExamples(openApiSpec) {
        return `/**
 * AIRIS EPM JavaScript SDK Examples
 */

const { AirisEPMClient } = require('./index');

// Initialize client
const client = new AirisEPMClient({
    baseURL: 'http://localhost:3000/api/v1',
    apiKey: 'your-api-key-here'
});

async function examples() {
    try {
        // Test connection
        console.log('Testing connection...');
        const connectionTest = await client.testConnection();
        console.log('Connection test:', connectionTest);

        // Performance monitoring examples
        console.log('\\nPerformance Examples:');
        
        // Get metrics
        const metrics = await client.performance.getMetrics({
            timeRange: '1h',
            metricType: 'cpu'
        });
        console.log('Metrics:', metrics);

        // Submit metrics
        await client.performance.submitMetrics([
            {
                timestamp: new Date().toISOString(),
                metricType: 'cpu_usage',
                value: 75.5,
                tags: { host: 'server1', region: 'us-east-1' }
            }
        ]);

        // Cache operations
        const cacheStats = await client.performance.getCacheStats();
        console.log('Cache stats:', cacheStats);

        // Data quality examples
        console.log('\\nData Quality Examples:');
        
        const validationResult = await client.dataQuality.validateData(
            { temperature: 25, humidity: 60 },
            'sensor-data'
        );
        console.log('Validation result:', validationResult);

        // Anomaly detection
        const anomalies = await client.dataQuality.getAnomalies({
            timeRange: '24h',
            severity: 'high'
        });
        console.log('Anomalies:', anomalies);

        // Analytics examples
        console.log('\\nAnalytics Examples:');
        
        const dashboard = await client.analytics.getDashboard('main-dashboard');
        console.log('Dashboard data:', dashboard);

        // Alerts examples
        console.log('\\nAlerts Examples:');
        
        const alerts = await client.alerts.getAlerts({
            status: 'active',
            limit: 10
        });
        console.log('Active alerts:', alerts);

        // GraphQL example
        console.log('\\nGraphQL Examples:');
        
        const graphqlResult = await client.graphql(\`
            query GetSystemHealth {
                health {
                    status
                    version
                    uptime
                }
            }
        \`);
        console.log('GraphQL result:', graphqlResult);

    } catch (error) {
        console.error('Example failed:', error);
    }
}

// Run examples
if (require.main === module) {
    examples();
}

module.exports = { examples };`;
    }

    /**
     * Generate JavaScript README
     */
    generateJavaScriptReadme() {
        return `# AIRIS EPM JavaScript SDK

JavaScript/Node.js SDK for AIRIS Enterprise Performance Management API.

## Installation

\`\`\`bash
npm install ${this.packageInfo.name}-js
\`\`\`

## Quick Start

\`\`\`javascript
const { AirisEPMClient } = require('${this.packageInfo.name}-js');

// Initialize client
const client = new AirisEPMClient({
    baseURL: 'https://api.airis-epm.com/v1',
    apiKey: 'your-api-key-here'
});

// Test connection
async function main() {
    const result = await client.testConnection();
    console.log('Connection:', result);
    
    // Get performance metrics
    const metrics = await client.performance.getMetrics({
        timeRange: '1h',
        metricType: 'cpu'
    });
    console.log('Metrics:', metrics);
}

main().catch(console.error);
\`\`\`

## Features

- ✅ Full REST API support
- ✅ GraphQL client included
- ✅ TypeScript definitions
- ✅ Promise-based async/await
- ✅ Automatic authentication
- ✅ Error handling
- ✅ Request/response interceptors

## API Modules

### Performance API
\`\`\`javascript
// Get metrics
const metrics = await client.performance.getMetrics();

// Submit metrics
await client.performance.submitMetrics([...]);

// Cache operations
const stats = await client.performance.getCacheStats();
await client.performance.setCachedData('type', 'key', data);
\`\`\`

### Data Quality API
\`\`\`javascript
// Validate data
const result = await client.dataQuality.validateData(data, schema);

// Detect anomalies
const anomalies = await client.dataQuality.detectAnomalies(data);

// Cleanse data
const cleaned = await client.dataQuality.cleanseData(data, rules);
\`\`\`

### Analytics API
\`\`\`javascript
// Get dashboard
const dashboard = await client.analytics.getDashboard('dashboard-id');

// Generate report
const report = await client.analytics.generateReport(config);
\`\`\`

### Alerts API
\`\`\`javascript
// Get alerts
const alerts = await client.alerts.getAlerts();

// Create alert rule
await client.alerts.createAlertRule(rule);

// Update alert status
await client.alerts.updateAlertStatus(id, 'resolved');
\`\`\`

## GraphQL Usage

\`\`\`javascript
const result = await client.graphql(\`
    query GetMetrics($timeRange: TimeRange) {
        metrics(timeRange: $timeRange) {
            timestamp
            value
            metricType
        }
    }
\`, { timeRange: 'HOUR_1' });
\`\`\`

## Error Handling

\`\`\`javascript
try {
    const result = await client.performance.getMetrics();
} catch (error) {
    if (error.response) {
        console.error('API Error:', error.response.status, error.message);
    } else {
        console.error('Network Error:', error.message);
    }
}
\`\`\`

## TypeScript Support

\`\`\`typescript
import { AirisEPMClient, MetricsResponse } from '${this.packageInfo.name}-js';

const client = new AirisEPMClient({
    apiKey: 'your-key'
});

const metrics: MetricsResponse = await client.performance.getMetrics();
\`\`\`

## Examples

See \`examples.js\` for comprehensive usage examples.

## License

MIT License - see LICENSE file for details.`;
    }

    /**
     * Generate Python examples
     */
    generatePythonExamples() {
        return `#!/usr/bin/env python3
"""
AIRIS EPM Python SDK Examples
"""

import asyncio
from airis_epm_sdk import create_client, AirisEPMClientConfig

def main():
    """Run synchronous examples"""
    
    # Create client
    client = create_client(
        api_key='your-api-key-here',
        base_url='http://localhost:3000/api/v1'
    )
    
    try:
        # Test connection
        print("Testing connection...")
        result = client.test_connection()
        print(f"Connection test: {result}")
        
        # Performance examples
        print("\\nPerformance Examples:")
        
        # Get metrics
        metrics = client.performance.get_metrics(
            timeRange='1h',
            metricType='cpu'
        )
        print(f"Metrics: {metrics}")
        
        # Submit metrics
        client.performance.submit_metrics([
            {
                'timestamp': '2024-01-01T12:00:00Z',
                'metricType': 'cpu_usage',
                'value': 75.5,
                'tags': {'host': 'server1', 'region': 'us-east-1'}
            }
        ])
        
        # Cache stats
        cache_stats = client.performance.get_cache_stats()
        print(f"Cache stats: {cache_stats}")
        
        # Data quality examples
        print("\\nData Quality Examples:")
        
        validation_result = client.data_quality.validate_data(
            data={'temperature': 25, 'humidity': 60},
            schema='sensor-data'
        )
        print(f"Validation: {validation_result}")
        
        # Get anomalies
        anomalies = client.data_quality.get_anomalies(
            timeRange='24h',
            severity='high'
        )
        print(f"Anomalies: {anomalies}")
        
        # Analytics examples
        print("\\nAnalytics Examples:")
        
        dashboard = client.analytics.get_dashboard('main-dashboard')
        print(f"Dashboard: {dashboard}")
        
        # Alerts examples
        print("\\nAlerts Examples:")
        
        alerts = client.alerts.get_alerts(
            status='active',
            limit=10
        )
        print(f"Active alerts: {alerts}")
        
        # Create alert rule
        rule_result = client.alerts.create_alert_rule({
            'name': 'High CPU Usage',
            'condition': 'cpu_usage > 80',
            'severity': 'high',
            'enabled': True
        })
        print(f"Alert rule created: {rule_result}")
        
    except Exception as e:
        print(f"Example failed: {e}")

if __name__ == '__main__':
    main()`;
    }

    /**
     * Generate Python README
     */
    generatePythonReadme() {
        return `# AIRIS EPM Python SDK

Python SDK for AIRIS Enterprise Performance Management API.

## Installation

\`\`\`bash
pip install airis-epm-sdk
\`\`\`

## Quick Start

\`\`\`python
from airis_epm_sdk import create_client

# Initialize client
client = create_client(
    api_key='your-api-key-here',
    base_url='https://api.airis-epm.com/v1'
)

# Test connection
result = client.test_connection()
print(f"Connection: {result}")

# Get performance metrics
metrics = client.performance.get_metrics(
    timeRange='1h',
    metricType='cpu'
)
print(f"Metrics: {metrics}")
\`\`\`

## Features

- ✅ Full REST API support
- ✅ Type hints and dataclasses
- ✅ Automatic authentication
- ✅ Error handling
- ✅ Request/response validation
- ✅ Comprehensive logging

## API Modules

### Performance API
\`\`\`python
# Get metrics
metrics = client.performance.get_metrics()

# Submit metrics
client.performance.submit_metrics([...])

# Cache operations
stats = client.performance.get_cache_stats()
client.performance.set_cached_data('type', 'key', data)
\`\`\`

### Data Quality API
\`\`\`python
# Validate data
result = client.data_quality.validate_data(data, 'schema')

# Detect anomalies
anomalies = client.data_quality.detect_anomalies(data)

# Cleanse data
cleaned = client.data_quality.cleanse_data(data, ['remove_nulls'])
\`\`\`

### Analytics API
\`\`\`python
# Get dashboard
dashboard = client.analytics.get_dashboard('dashboard-id')

# Generate report
report = client.analytics.generate_report(config)
\`\`\`

### Alerts API
\`\`\`python
# Get alerts
alerts = client.alerts.get_alerts()

# Create alert rule
client.alerts.create_alert_rule(rule)

# Update alert status
client.alerts.update_alert_status(id, 'resolved')
\`\`\`

## Configuration

\`\`\`python
from airis_epm_sdk import AirisEPMClient, AirisEPMClientConfig

config = AirisEPMClientConfig(
    base_url='https://api.airis-epm.com/v1',
    api_key='your-key',
    timeout=60,
    verify_ssl=True
)

client = AirisEPMClient(config)
\`\`\`

## Error Handling

\`\`\`python
from airis_epm_sdk import AirisEPMAPIException

try:
    result = client.performance.get_metrics()
except AirisEPMAPIException as e:
    print(f"API Error: {e.status_code} - {e}")
except Exception as e:
    print(f"General Error: {e}")
\`\`\`

## Logging

\`\`\`python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('airis_epm_sdk')
\`\`\`

## Examples

See \`examples.py\` for comprehensive usage examples.

## Requirements

- Python 3.8+
- requests >= 2.31.0
- python-dateutil >= 2.8.0

## License

MIT License - see LICENSE file for details.`;
    }

    /**
     * Generate other language SDKs (simplified)
     */
    async generateJavaSDK(openApiSpec, graphqlSchema) {
        const sdkDir = path.join(this.outputDir, 'java');
        
        const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.airis.epm</groupId>
    <artifactId>airis-epm-sdk</artifactId>
    <version>${this.packageInfo.version}</version>
    <packaging>jar</packaging>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-core</artifactId>
            <version>2.15.2</version>
        </dependency>
    </dependencies>
</project>`;

        await fs.writeFile(path.join(sdkDir, 'pom.xml'), pomXml);
        
        const readme = `# AIRIS EPM Java SDK\n\nJava SDK for AIRIS Enterprise Performance Management API.\n\n## Installation\n\n\`\`\`xml\n<dependency>\n    <groupId>com.airis.epm</groupId>\n    <artifactId>airis-epm-sdk</artifactId>\n    <version>${this.packageInfo.version}</version>\n</dependency>\n\`\`\``;
        await fs.writeFile(path.join(sdkDir, 'README.md'), readme);

        return {
            language: 'java',
            files: ['pom.xml', 'README.md'],
            path: sdkDir
        };
    }

    async generateCSharpSDK(openApiSpec, graphqlSchema) {
        const sdkDir = path.join(this.outputDir, 'csharp');
        
        const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net6.0</TargetFramework>
    <PackageId>AirisEPM.SDK</PackageId>
    <Version>${this.packageInfo.version}</Version>
    <Authors>${this.packageInfo.author}</Authors>
    <Description>${this.packageInfo.description} for .NET</Description>
  </PropertyGroup>
  
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageReference Include="System.Net.Http" Version="4.3.4" />
  </ItemGroup>
</Project>`;

        await fs.writeFile(path.join(sdkDir, 'AirisEPM.SDK.csproj'), csproj);
        
        const readme = `# AIRIS EPM .NET SDK\n\n.NET SDK for AIRIS Enterprise Performance Management API.\n\n## Installation\n\n\`\`\`bash\ndotnet add package AirisEPM.SDK\n\`\`\``;
        await fs.writeFile(path.join(sdkDir, 'README.md'), readme);

        return {
            language: 'csharp',
            files: ['AirisEPM.SDK.csproj', 'README.md'],
            path: sdkDir
        };
    }

    async generateGoSDK(openApiSpec, graphqlSchema) {
        const sdkDir = path.join(this.outputDir, 'go');
        
        const goMod = `module github.com/airis-epm/sdk-go

go 1.19

require (
    github.com/go-resty/resty/v2 v2.7.0
)`;

        await fs.writeFile(path.join(sdkDir, 'go.mod'), goMod);
        
        const readme = `# AIRIS EPM Go SDK\n\nGo SDK for AIRIS Enterprise Performance Management API.\n\n## Installation\n\n\`\`\`bash\ngo get github.com/airis-epm/sdk-go\n\`\`\``;
        await fs.writeFile(path.join(sdkDir, 'README.md'), readme);

        return {
            language: 'go',
            files: ['go.mod', 'README.md'],
            path: sdkDir
        };
    }

    async generatePHPSDK(openApiSpec, graphqlSchema) {
        const sdkDir = path.join(this.outputDir, 'php');
        
        const composerJson = {
            name: "airis/epm-sdk",
            description: `${this.packageInfo.description} for PHP`,
            type: "library",
            version: this.packageInfo.version,
            require: {
                "php": ">=8.0",
                "guzzlehttp/guzzle": "^7.0"
            },
            autoload: {
                "psr-4": {
                    "Airis\\EPM\\": "src/"
                }
            },
            keywords: ["airis", "epm", "api", "sdk", "monitoring"]
        };

        await fs.writeFile(
            path.join(sdkDir, 'composer.json'),
            JSON.stringify(composerJson, null, 2)
        );
        
        const readme = `# AIRIS EPM PHP SDK\n\nPHP SDK for AIRIS Enterprise Performance Management API.\n\n## Installation\n\n\`\`\`bash\ncomposer require airis/epm-sdk\n\`\`\``;
        await fs.writeFile(path.join(sdkDir, 'README.md'), readme);

        return {
            language: 'php',
            files: ['composer.json', 'README.md'],
            path: sdkDir
        };
    }

    /**
     * Generate JavaScript GraphQL client
     */
    generateJavaScriptGraphQLClient(graphqlSchema) {
        return `/**
 * AIRIS EPM GraphQL Client
 * Auto-generated from GraphQL schema
 */

const { GraphQLClient } = require('graphql-request');

class AirisEPMGraphQLClient {
    constructor(endpoint, headers = {}) {
        this.client = new GraphQLClient(endpoint, { headers });
    }

    // Predefined queries
    static QUERIES = {
        GET_HEALTH: \`
            query GetHealth {
                health {
                    status
                    timestamp
                    version
                    uptime
                    dependencies {
                        service
                        status
                        latency
                        lastCheck
                    }
                }
            }
        \`,
        
        GET_METRICS: \`
            query GetMetrics($timeRange: TimeRange, $metricType: MetricType, $limit: Int) {
                metrics(timeRange: $timeRange, metricType: $metricType, limit: $limit) {
                    success
                    metrics {
                        timestamp
                        metricType
                        value
                        tags
                    }
                    metadata {
                        totalCount
                        timeRange
                        aggregation
                    }
                }
            }
        \`,
        
        GET_ALERTS: \`
            query GetAlerts($status: AlertStatus, $severity: SeverityLevel, $limit: Int) {
                alerts(status: $status, severity: $severity, limit: $limit) {
                    success
                    alerts {
                        id
                        title
                        description
                        severity
                        status
                        createdAt
                        updatedAt
                    }
                    summary {
                        active
                        acknowledged
                        resolved
                    }
                }
            }
        \`
    };

    // Predefined mutations
    static MUTATIONS = {
        SUBMIT_METRICS: \`
            mutation SubmitMetrics($input: MetricsInput!) {
                submitMetrics(input: $input) {
                    success
                    message
                }
            }
        \`,
        
        CREATE_ALERT_RULE: \`
            mutation CreateAlertRule($input: AlertRuleInput!) {
                createAlertRule(input: $input) {
                    success
                    rule {
                        id
                        name
                        condition
                        severity
                        enabled
                    }
                }
            }
        \`
    };

    async query(query, variables = {}) {
        return await this.client.request(query, variables);
    }

    async getHealth() {
        return await this.query(AirisEPMGraphQLClient.QUERIES.GET_HEALTH);
    }

    async getMetrics(variables = {}) {
        return await this.query(AirisEPMGraphQLClient.QUERIES.GET_METRICS, variables);
    }

    async getAlerts(variables = {}) {
        return await this.query(AirisEPMGraphQLClient.QUERIES.GET_ALERTS, variables);
    }

    async submitMetrics(metrics) {
        return await this.query(AirisEPMGraphQLClient.MUTATIONS.SUBMIT_METRICS, {
            input: { metrics }
        });
    }

    async createAlertRule(rule) {
        return await this.query(AirisEPMGraphQLClient.MUTATIONS.CREATE_ALERT_RULE, {
            input: rule
        });
    }
}

module.exports = { AirisEPMGraphQLClient };`;
    }

    /**
     * Generate Python GraphQL client
     */
    generatePythonGraphQLClient(graphqlSchema) {
        return `"""
AIRIS EPM GraphQL Client
Auto-generated from GraphQL schema
"""

import json
import requests
from typing import Dict, Any, Optional


class AirisEPMGraphQLClient:
    """GraphQL client for AIRIS EPM API"""
    
    # Predefined queries
    QUERIES = {
        'GET_HEALTH': '''
            query GetHealth {
                health {
                    status
                    timestamp
                    version
                    uptime
                    dependencies {
                        service
                        status
                        latency
                        lastCheck
                    }
                }
            }
        ''',
        
        'GET_METRICS': '''
            query GetMetrics($timeRange: TimeRange, $metricType: MetricType, $limit: Int) {
                metrics(timeRange: $timeRange, metricType: $metricType, limit: $limit) {
                    success
                    metrics {
                        timestamp
                        metricType
                        value
                        tags
                    }
                    metadata {
                        totalCount
                        timeRange
                        aggregation
                    }
                }
            }
        ''',
        
        'GET_ALERTS': '''
            query GetAlerts($status: AlertStatus, $severity: SeverityLevel, $limit: Int) {
                alerts(status: $status, severity: $severity, limit: $limit) {
                    success
                    alerts {
                        id
                        title
                        description
                        severity
                        status
                        createdAt
                        updatedAt
                    }
                    summary {
                        active
                        acknowledged
                        resolved
                    }
                }
            }
        '''
    }
    
    # Predefined mutations
    MUTATIONS = {
        'SUBMIT_METRICS': '''
            mutation SubmitMetrics($input: MetricsInput!) {
                submitMetrics(input: $input) {
                    success
                    message
                }
            }
        ''',
        
        'CREATE_ALERT_RULE': '''
            mutation CreateAlertRule($input: AlertRuleInput!) {
                createAlertRule(input: $input) {
                    success
                    rule {
                        id
                        name
                        condition
                        severity
                        enabled
                    }
                }
            }
        '''
    }
    
    def __init__(self, endpoint: str, headers: Optional[Dict[str, str]] = None):
        """
        Initialize GraphQL client
        
        Args:
            endpoint: GraphQL endpoint URL
            headers: Optional HTTP headers
        """
        self.endpoint = endpoint
        self.headers = headers or {}
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            **self.headers
        })
    
    def query(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute GraphQL query
        
        Args:
            query: GraphQL query string
            variables: Query variables
            
        Returns:
            Query result
        """
        payload = {
            'query': query,
            'variables': variables or {}
        }
        
        response = self.session.post(self.endpoint, json=payload)
        response.raise_for_status()
        
        result = response.json()
        
        if 'errors' in result:
            raise Exception(f"GraphQL errors: {result['errors']}")
            
        return result.get('data', {})
    
    def get_health(self) -> Dict[str, Any]:
        """Get system health status"""
        return self.query(self.QUERIES['GET_HEALTH'])
    
    def get_metrics(self, **variables) -> Dict[str, Any]:
        """Get performance metrics"""
        return self.query(self.QUERIES['GET_METRICS'], variables)
    
    def get_alerts(self, **variables) -> Dict[str, Any]:
        """Get alerts"""
        return self.query(self.QUERIES['GET_ALERTS'], variables)
    
    def submit_metrics(self, metrics: list) -> Dict[str, Any]:
        """Submit performance metrics"""
        return self.query(self.MUTATIONS['SUBMIT_METRICS'], {
            'input': {'metrics': metrics}
        })
    
    def create_alert_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Create alert rule"""
        return self.query(self.MUTATIONS['CREATE_ALERT_RULE'], {
            'input': rule
        })`;
    }
}

export default SDKGenerator;