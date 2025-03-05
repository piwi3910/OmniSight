/**
 * Monitoring and health check utilities for OmniSight services
 */
import { Request, Response, NextFunction, Router } from 'express';
import axios from 'axios';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Logger interface for monitoring
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  debug?(message: string, ...args: unknown[]): void;
}

/**
 * Health check dependency details
 */
export interface DependencyDetails {
  responseTimeMs?: number;
  error?: string;
  status?: HealthStatus;
  [key: string]: unknown;
}
/**
 * Health status enum
 */
export enum HealthStatus {
  OK = 'ok',
  DEGRADED = 'degraded',
  ERROR = 'error',
}

/**
 * Dependency type enum
 */
export enum DependencyType {
  DATABASE = 'database',
  MESSAGE_QUEUE = 'message_queue',
  SERVICE = 'service',
  FILESYSTEM = 'filesystem',
  CACHE = 'cache',
  EXTERNAL_API = 'external_api',
}

/**
 * Health check dependency configuration
 */
export interface HealthCheckDependency {
  /** Dependency name */
  name: string;

  /** Dependency type */
  type: DependencyType;

  /** Health check function */
  check: () => Promise<{
    status: HealthStatus;
    details?: DependencyDetails;
    responseTime?: number;
  }>;

  /** Critical dependency - if this fails, the service is considered down */
  critical?: boolean;
}

/**
 * Health check response format
 */
export interface HealthCheckResponse {
  /** Overall service status */
  status: HealthStatus;

  /** Service name */
  service: string;

  /** Service version */
  version: string;

  /** Response timestamp */
  timestamp: string;

  /** Unique request ID */
  requestId: string;

  /** Uptime in seconds */
  uptime: number;

  /** Memory usage in MB */
  memory: {
    /** Used memory in MB */
    used: number;

    /** Total memory in MB */
    total: number;

    /** Free memory in MB */
    free: number;

    /** Memory usage percentage */
    usagePercent: number;
  };

  /** CPU usage information */
  cpu: {
    /** Number of CPUs */
    cores: number;

    /** Load average (1, 5, 15 minutes) */
    loadAvg: number[];
  };

  /** Dependencies health status */
  dependencies: Record<
    string,
    {
      status: HealthStatus;
      type: DependencyType;
      responseTime?: number;
      details?: DependencyDetails;
    }
  >;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Service name */
  serviceName: string;

  /** Service version */
  version: string;

  /** Service dependencies */
  dependencies?: HealthCheckDependency[];

  /** Health check interval in milliseconds */
  checkInterval?: number;

  /** Logger instance */
  logger?: Logger;
}

/**
 * Health check manager
 *
 * Handles health check endpoints and monitoring
 */
export class HealthCheckManager {
  private serviceName: string;
  private version: string;
  private dependencies: HealthCheckDependency[];
  private checkInterval: number;
  private startTime: number;
  private lastCheckResult: HealthCheckResponse | null = null;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private logger: Logger;

  /**
   * Create a new health check manager
   */
  constructor(config: HealthCheckConfig) {
    this.serviceName = config.serviceName;
    this.version = config.version;
    this.dependencies = config.dependencies || [];
    this.checkInterval = config.checkInterval || 60000; // Default: 1 minute
    this.startTime = Date.now();
    this.logger = config.logger || console;
  }

  /**
   * Start periodic health checks
   */
  public startMonitoring(): void {
    if (this.checkIntervalId) {
      return;
    }

    this.logger.info(`Starting health check monitoring for ${this.serviceName}`);

    // Perform initial health check
    this.performHealthCheck()
      .then(result => {
        this.lastCheckResult = result;
        this.logger.info(`Initial health check: ${result.status}`);
      })
      .catch(err => {
        this.logger.error('Failed to perform initial health check', err);
      });

    // Set up periodic health checks
    this.checkIntervalId = setInterval(async () => {
      try {
        this.lastCheckResult = await this.performHealthCheck();

        // Log if status changed
        const previousStatus = this.lastCheckResult ? this.lastCheckResult.status : null;
        if (previousStatus !== this.lastCheckResult.status) {
          this.logger.info(
            `Health status changed: ${previousStatus} -> ${this.lastCheckResult.status}`
          );
        }

        // Log errors for any dependency that failed
        for (const [depName, depStatus] of Object.entries(this.lastCheckResult.dependencies)) {
          if (depStatus.status === HealthStatus.ERROR) {
            this.logger.error(
              `Dependency ${depName} is failing: ${JSON.stringify(depStatus.details)}`
            );
          } else if (depStatus.status === HealthStatus.DEGRADED) {
            this.logger.warn(
              `Dependency ${depName} is degraded: ${JSON.stringify(depStatus.details)}`
            );
          }
        }
      } catch (err) {
        this.logger.error('Failed to perform health check', err);
      }
    }, this.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  public stopMonitoring(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      this.logger.info(`Stopped health check monitoring for ${this.serviceName}`);
    }
  }

  /**
   * Perform a health check
   */
  public async performHealthCheck(): Promise<HealthCheckResponse> {
    const startTime = process.hrtime();
    const timestamp = new Date().toISOString();
    const requestId = uuidv4();

    // Check all dependencies
    const dependencyResults: Record<
      string,
      {
        status: HealthStatus;
        type: DependencyType;
        responseTime?: number;
        details?: DependencyDetails;
      }
    > = {};
    let overallStatus = HealthStatus.OK;

    await Promise.all(
      this.dependencies.map(async dependency => {
        try {
          const result = await dependency.check();

          dependencyResults[dependency.name] = {
            status: result.status,
            type: dependency.type,
            responseTime: result.responseTime,
            details: result.details,
          };

          // Update overall status based on dependency status
          if (
            dependency.critical &&
            result.status === HealthStatus.ERROR &&
            overallStatus !== HealthStatus.ERROR
          ) {
            overallStatus = HealthStatus.ERROR;
          } else if (result.status === HealthStatus.DEGRADED && overallStatus === HealthStatus.OK) {
            overallStatus = HealthStatus.DEGRADED;
          }
        } catch (error) {
          dependencyResults[dependency.name] = {
            status: HealthStatus.ERROR,
            type: dependency.type,
            details: {
              error: error instanceof Error ? error.message : String(error),
            },
          };

          if (dependency.critical && overallStatus !== HealthStatus.ERROR) {
            overallStatus = HealthStatus.ERROR;
          } else if (overallStatus === HealthStatus.OK) {
            overallStatus = HealthStatus.DEGRADED;
          }
        }
      })
    );

    // Calculate uptime
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    // Get memory usage
    const usedMemory = process.memoryUsage().rss / 1024 / 1024;
    const totalMemory = os.totalmem() / 1024 / 1024;
    const freeMemory = os.freemem() / 1024 / 1024;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    // Get CPU info
    const cpuCores = os.cpus().length;
    const loadAvg = os.loadavg();

    // Calculate response time
    const hrtime = process.hrtime(startTime);
    const responseTimeMs = hrtime[0] * 1000 + hrtime[1] / 1000000;

    // Build health check response
    const response: HealthCheckResponse = {
      status: overallStatus,
      service: this.serviceName,
      version: this.version,
      timestamp,
      requestId,
      uptime,
      memory: {
        used: Math.round(usedMemory * 100) / 100,
        total: Math.round(totalMemory * 100) / 100,
        free: Math.round(freeMemory * 100) / 100,
        usagePercent: Math.round(memoryUsagePercent * 100) / 100,
      },
      cpu: {
        cores: cpuCores,
        loadAvg,
      },
      dependencies: dependencyResults,
    };

    return response;
  }

  /**
   * Get the last health check result
   */
  public getLastHealthCheckResult(): HealthCheckResponse | null {
    return this.lastCheckResult;
  }

  /**
   * Get Express middleware for health check endpoint
   */
  public getHealthCheckMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Perform health check
        const healthCheck = await this.performHealthCheck();

        // Set status code based on health status
        let statusCode = 200;
        if (healthCheck.status === HealthStatus.DEGRADED) {
          statusCode = 200; // Still OK but with warnings
        } else if (healthCheck.status === HealthStatus.ERROR) {
          statusCode = 503; // Service Unavailable
        }

        // Send response
        res.status(statusCode).json(healthCheck);
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Create Express router with health check endpoints
   */
  public getHealthCheckRouter(): Router {
    const router = Router();

    // Health check endpoint
    router.get('/health', this.getHealthCheckMiddleware());

    // Liveness probe (simplified health check for Kubernetes)
    router.get('/health/liveness', (req, res) => {
      res.status(200).json({
        status: this.lastCheckResult?.status || HealthStatus.OK,
        service: this.serviceName,
        timestamp: new Date().toISOString(),
      });
    });

    // Readiness probe (checks dependencies)
    router.get('/health/readiness', async (req, res) => {
      const healthCheck = await this.performHealthCheck();

      let statusCode = 200;
      if (healthCheck.status === HealthStatus.ERROR) {
        statusCode = 503; // Service Unavailable
      }

      res.status(statusCode).json({
        status: healthCheck.status,
        service: this.serviceName,
        timestamp: healthCheck.timestamp,
        dependencies: healthCheck.dependencies,
      });
    });

    return router;
  }
}

/**
 * Common dependencies for health checks
 */
export const commonDependencies = {
  /**
   * Create a database health check
   */
  createDatabaseCheck: (config: {
    checkFn: () => Promise<unknown>;
    name?: string;
    critical?: boolean;
  }): HealthCheckDependency => {
    return {
      name: config.name || 'database',
      type: DependencyType.DATABASE,
      critical: config.critical !== undefined ? config.critical : true,
      check: async () => {
        const startTime = Date.now();
        try {
          await config.checkFn();
          const responseTime = Date.now() - startTime;

          return {
            status: HealthStatus.OK,
            responseTime,
            details: {
              responseTimeMs: responseTime,
            },
          };
        } catch (error) {
          const responseTime = Date.now() - startTime;

          return {
            status: HealthStatus.ERROR,
            responseTime,
            details: {
              error: error instanceof Error ? error.message : String(error),
              responseTimeMs: responseTime,
            },
          };
        }
      },
    };
  },

  /**
   * Create a RabbitMQ health check
   */
  createRabbitMQCheck: (config: {
    checkFn: () => Promise<unknown>;
    name?: string;
    critical?: boolean;
  }): HealthCheckDependency => {
    return {
      name: config.name || 'rabbitmq',
      type: DependencyType.MESSAGE_QUEUE,
      critical: config.critical !== undefined ? config.critical : true,
      check: async () => {
        const startTime = Date.now();
        try {
          await config.checkFn();
          const responseTime = Date.now() - startTime;

          return {
            status: HealthStatus.OK,
            responseTime,
            details: {
              responseTimeMs: responseTime,
            },
          };
        } catch (error) {
          const responseTime = Date.now() - startTime;

          return {
            status: HealthStatus.ERROR,
            responseTime,
            details: {
              error: error instanceof Error ? error.message : String(error),
              responseTimeMs: responseTime,
            },
          };
        }
      },
    };
  },

  /**
   * Create a service health check
   */
  createServiceCheck: (config: {
    url: string;
    name: string;
    timeoutMs?: number;
    critical?: boolean;
  }): HealthCheckDependency => {
    return {
      name: config.name,
      type: DependencyType.SERVICE,
      critical: config.critical !== undefined ? config.critical : false,
      check: async () => {
        const startTime = Date.now();
        try {
          const response = await axios.get(`${config.url}/health/liveness`, {
            timeout: config.timeoutMs || 5000,
          });

          const responseTime = Date.now() - startTime;
          const serviceStatus = response.data.status;

          if (serviceStatus === HealthStatus.ERROR) {
            return {
              status: HealthStatus.ERROR,
              responseTime,
              details: {
                status: serviceStatus,
                responseTimeMs: responseTime,
              },
            };
          } else if (serviceStatus === HealthStatus.DEGRADED) {
            return {
              status: HealthStatus.DEGRADED,
              responseTime,
              details: {
                status: serviceStatus,
                responseTimeMs: responseTime,
              },
            };
          } else {
            return {
              status: HealthStatus.OK,
              responseTime,
              details: {
                responseTimeMs: responseTime,
              },
            };
          }
        } catch (error) {
          const responseTime = Date.now() - startTime;

          return {
            status: HealthStatus.ERROR,
            responseTime,
            details: {
              error: axios.isAxiosError(error)
                ? `${error.message} (${error.code})`
                : error instanceof Error
                  ? error.message
                  : String(error),
              responseTimeMs: responseTime,
            },
          };
        }
      },
    };
  },

  /**
   * Create a filesystem health check
   */
  createFilesystemCheck: (config: {
    checkFn: () => Promise<unknown>;
    name?: string;
    critical?: boolean;
  }): HealthCheckDependency => {
    return {
      name: config.name || 'filesystem',
      type: DependencyType.FILESYSTEM,
      critical: config.critical !== undefined ? config.critical : true,
      check: async () => {
        const startTime = Date.now();
        try {
          await config.checkFn();
          const responseTime = Date.now() - startTime;

          return {
            status: HealthStatus.OK,
            responseTime,
            details: {
              responseTimeMs: responseTime,
            },
          };
        } catch (error) {
          const responseTime = Date.now() - startTime;

          return {
            status: HealthStatus.ERROR,
            responseTime,
            details: {
              error: error instanceof Error ? error.message : String(error),
              responseTimeMs: responseTime,
            },
          };
        }
      },
    };
  },
};

/**
 * Create a health check manager
 */
export function createHealthCheckManager(config: HealthCheckConfig): HealthCheckManager {
  return new HealthCheckManager(config);
}
