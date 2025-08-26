/**
 * AIRIS EPM API Client
 * Handles all API communications with the integration adapter
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios'

// API Configuration
const API_BASE_URL = 'http://localhost:3100'

class APIClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle auth errors
          localStorage.removeItem('auth_token')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health')
    return response.data
  }

  // Dashboard APIs
  async getDashboardOverview() {
    const response = await this.client.get('/api/dashboard/overview')
    return response.data
  }

  async getRealtimeData() {
    const response = await this.client.get('/api/dashboard/realtime')
    return response.data
  }

  async getPerformanceMetrics(timeRange: string = '1h') {
    const response = await this.client.get('/api/dashboard/performance', {
      params: { timeRange }
    })
    return response.data
  }

  // APM APIs
  async getJ2EEMetrics() {
    const response = await this.client.get('/api/apm/j2ee/metrics')
    return response.data
  }

  async getWASStatus() {
    const response = await this.client.get('/api/apm/was/status')
    return response.data
  }

  async getExceptions() {
    const response = await this.client.get('/api/apm/exceptions')
    return response.data
  }

  async getServiceTopology() {
    const response = await this.client.get('/api/apm/topology')
    return response.data
  }

  async getAlerts() {
    const response = await this.client.get('/api/apm/alerts')
    return response.data
  }

  // Authentication APIs
  async login(credentials: { username: string; password: string }) {
    const response = await this.client.post('/api/auth/login', credentials)
    if (response.data.success && response.data.token) {
      localStorage.setItem('auth_token', response.data.token)
    }
    return response.data
  }

  async getCurrentUser() {
    const response = await this.client.get('/api/auth/user')
    return response.data
  }

  logout() {
    localStorage.removeItem('auth_token')
  }
}

// Export singleton instance
export const apiClient = new APIClient()

// TypeScript interfaces for API responses
export interface APIResponse<T> {
  success: boolean
  data: T
  timestamp?: string
  error?: string
  message?: string
}

export interface DashboardOverview {
  system: {
    status: string
    completion: string
    uptime: string
    korean_time: string
  }
  services: {
    total: number
    healthy: number
    unhealthy: number
    details: Record<string, string>
  }
  metrics: {
    total_events: number
    avg_response_time: string
    error_rate: string
    throughput: string
  }
}

export interface RealtimeMetric {
  name: string
  value: number
  unit: string
}

export interface RealtimeData {
  timestamp: string
  korean_time: string
  metrics: RealtimeMetric[]
}

export interface PerformanceData {
  timeRange: string
  data: Array<{
    time: string
    cpu: number
    memory: number
    responseTime: number
    throughput: number
  }>
}

export interface J2EEMetrics {
  servlets: Array<{
    name: string
    requests: number
    avgResponseTime: number
    errors: number
  }>
  jsps: Array<{
    name: string
    requests: number
    avgResponseTime: number
    errors: number
  }>
  ejbs: Array<{
    name: string
    calls: number
    avgResponseTime: number
    errors: number
  }>
}

export interface WASStatus {
  servers: Array<{
    name: string
    status: string
    jvm: {
      heap: number
      nonHeap: number
      threads: number
    }
    threadPools: {
      active: number
      idle: number
      max: number
    }
  }>
}

export interface Exception {
  id: number
  timestamp: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  service: string
  count: number
}

export interface ExceptionData {
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  }
  recent: Exception[]
}

export interface ServiceTopology {
  nodes: Array<{
    id: string
    name: string
    type: string
    status: string
  }>
  edges: Array<{
    from: string
    to: string
    status: string
    latency: number
  }>
}

export interface Alert {
  id: number
  timestamp: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  service: string
}

export interface AlertData {
  active: Alert[]
  resolved: Alert[]
}

export interface User {
  id: number
  username: string
  name: string
  role: string
  permissions: string[]
}

export default apiClient