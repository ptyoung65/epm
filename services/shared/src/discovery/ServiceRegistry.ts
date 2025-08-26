import Consul from 'consul';

export interface ServiceRegistrationOptions {
  name: string;
  id: string;
  address: string;
  port: number;
  tags?: string[];
  check?: {
    http?: string;
    tcp?: string;
    interval?: string;
    timeout?: string;
  };
  meta?: Record<string, string>;
}

export interface ServiceInstance {
  id: string;
  name: string;
  address: string;
  port: number;
  tags: string[];
  meta: Record<string, string>;
  healthy: boolean;
}

export class ServiceRegistry {
  private consul: Consul.Consul;
  private registeredServices: Set<string> = new Set();
  private watchHandlers: Map<string, any> = new Map();

  constructor(options: { host: string; port: number }) {
    this.consul = new Consul({
      host: options.host,
      port: options.port.toString(),
      promisify: true
    });
  }

  /**
   * Register a service with Consul
   */
  async register(options: ServiceRegistrationOptions): Promise<void> {
    const registration: any = {
      name: options.name,
      id: options.id,
      address: options.address,
      port: options.port,
      tags: options.tags || [],
      meta: options.meta || {}
    };

    if (options.check) {
      registration.check = {
        ...options.check,
        deregistercriticalserviceafter: '1m'
      };
    }

    await this.consul.agent.service.register(registration);
    this.registeredServices.add(options.id);
  }

  /**
   * Deregister a service from Consul
   */
  async deregister(serviceId?: string): Promise<void> {
    if (serviceId) {
      await this.consul.agent.service.deregister(serviceId);
      this.registeredServices.delete(serviceId);
    } else {
      // Deregister all services
      for (const id of this.registeredServices) {
        await this.consul.agent.service.deregister(id);
      }
      this.registeredServices.clear();
    }
  }

  /**
   * Discover service instances
   */
  async discover(serviceName: string, onlyHealthy: boolean = true): Promise<ServiceInstance[]> {
    const options: any = {
      service: serviceName,
      passing: onlyHealthy
    };

    const result = await this.consul.health.service(options);
    
    return result.map((entry: any) => ({
      id: entry.Service.ID,
      name: entry.Service.Service,
      address: entry.Service.Address,
      port: entry.Service.Port,
      tags: entry.Service.Tags || [],
      meta: entry.Service.Meta || {},
      healthy: entry.Checks.every((check: any) => check.Status === 'passing')
    }));
  }

  /**
   * Get a single healthy service instance (load balancing)
   */
  async getServiceInstance(serviceName: string): Promise<ServiceInstance | null> {
    const instances = await this.discover(serviceName, true);
    
    if (instances.length === 0) {
      return null;
    }

    // Simple round-robin selection
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }

  /**
   * Watch for service changes
   */
  watch(serviceName: string, callback: (instances: ServiceInstance[]) => void): void {
    const watchOptions = {
      method: this.consul.health.service,
      options: {
        service: serviceName,
        passing: true
      }
    };

    const watcher = this.consul.watch(watchOptions);

    watcher.on('change', async () => {
      const instances = await this.discover(serviceName, true);
      callback(instances);
    });

    watcher.on('error', (error: Error) => {
      console.error(`Watch error for service ${serviceName}:`, error);
    });

    this.watchHandlers.set(serviceName, watcher);
  }

  /**
   * Stop watching a service
   */
  unwatch(serviceName: string): void {
    const watcher = this.watchHandlers.get(serviceName);
    if (watcher) {
      watcher.end();
      this.watchHandlers.delete(serviceName);
    }
  }

  /**
   * Store configuration in Consul KV
   */
  async setConfig(key: string, value: any): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    await this.consul.kv.set(key, data);
  }

  /**
   * Retrieve configuration from Consul KV
   */
  async getConfig<T = any>(key: string): Promise<T | null> {
    try {
      const result = await this.consul.kv.get(key);
      if (!result) {
        return null;
      }

      const value = result.Value;
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Watch configuration changes
   */
  watchConfig(key: string, callback: (value: any) => void): void {
    const watchOptions = {
      method: this.consul.kv.get,
      options: { key }
    };

    const watcher = this.consul.watch(watchOptions);

    watcher.on('change', (data: any) => {
      if (data) {
        const value = data.Value;
        try {
          callback(JSON.parse(value));
        } catch {
          callback(value);
        }
      }
    });

    watcher.on('error', (error: Error) => {
      console.error(`Watch error for config ${key}:`, error);
    });

    this.watchHandlers.set(`config:${key}`, watcher);
  }

  /**
   * Create a distributed lock
   */
  async acquireLock(key: string, sessionTTL: string = '15s'): Promise<string> {
    // Create a session
    const session = await this.consul.session.create({
      ttl: sessionTTL,
      behavior: 'delete'
    });

    // Acquire the lock
    const acquired = await this.consul.kv.set({
      key: `locks/${key}`,
      value: '',
      acquire: session.ID
    });

    if (!acquired) {
      await this.consul.session.destroy(session.ID);
      throw new Error(`Failed to acquire lock for ${key}`);
    }

    return session.ID;
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(key: string, sessionId: string): Promise<void> {
    await this.consul.kv.del({
      key: `locks/${key}`,
      release: sessionId
    });
    await this.consul.session.destroy(sessionId);
  }

  /**
   * Health check pass
   */
  async passHealthCheck(checkId: string): Promise<void> {
    await this.consul.agent.check.pass(checkId);
  }

  /**
   * Health check fail
   */
  async failHealthCheck(checkId: string, note?: string): Promise<void> {
    await this.consul.agent.check.fail({ id: checkId, note });
  }

  /**
   * Health check warn
   */
  async warnHealthCheck(checkId: string, note?: string): Promise<void> {
    await this.consul.agent.check.warn({ id: checkId, note });
  }
}