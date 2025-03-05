import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Logger interface for service communication
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
} /**
 * Configuration options for service communication
 */
export interface ServiceCommunicationOptions {
  /**
   * Base URL for the service
   */
  baseUrl: string;

  /**
   * Default timeout in milliseconds
   */
  timeout?: number;

  /**
   * Maximum number of retries
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds
   */
  initialRetryDelay?: number;

  /**
   * Maximum retry delay in milliseconds
   */
  maxRetryDelay?: number;

  /**
   * Whether to use exponential backoff for retries
   */
  useExponentialBackoff?: boolean;

  /**
   * Headers to include with all requests
   */
  headers?: Record<string, string>;

  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED, // Normal operation
  OPEN, // Failing, no requests allowed
  HALF_OPEN, // Testing if service is back
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /**
   * Number of failures before opening the circuit
   */
  failureThreshold: number;

  /**
   * Time in milliseconds to wait before trying again
   */
  resetTimeout: number;

  /**
   * Maximum number of concurrent requests in half-open state
   */
  halfOpenMaxConcurrent?: number;
}

/**
 * Default circuit breaker options
 */
const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenMaxConcurrent: 1,
};

/**
 * Service communication client with retry and circuit breaker
 */
export class ServiceCommunicationClient {
  private axiosInstance: AxiosInstance;
  private options: ServiceCommunicationOptions;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private nextAttempt: number = 0;
  private halfOpenRequests: number = 0;
  private circuitBreakerOptions: CircuitBreakerOptions;
  private logger: Logger;

  /**
   * Create a new service communication client
   */
  constructor(
    options: ServiceCommunicationOptions,
    circuitBreakerOptions: CircuitBreakerOptions = DEFAULT_CIRCUIT_BREAKER_OPTIONS
  ) {
    this.options = {
      timeout: 5000,
      maxRetries: 3,
      initialRetryDelay: 1000,
      maxRetryDelay: 10000,
      useExponentialBackoff: true,
      ...options,
    };

    this.circuitBreakerOptions = {
      ...DEFAULT_CIRCUIT_BREAKER_OPTIONS,
      ...circuitBreakerOptions,
    };

    this.logger = this.options.logger || {
      info: () => {},
      error: () => {},
      debug: () => {},
    };

    // Create Axios instance
    this.axiosInstance = axios.create({
      baseURL: this.options.baseUrl,
      timeout: this.options.timeout,
      headers: this.options.headers,
    });
  }

  /**
   * Check if circuit breaker allows requests
   */
  private canRequest(): boolean {
    const now = Date.now();

    switch (this.circuitState) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (now >= this.nextAttempt) {
          this.circuitState = CircuitState.HALF_OPEN;
          this.logger.info(`Circuit is now half-open for ${this.options.baseUrl}`);
          return this.halfOpenRequests < this.circuitBreakerOptions.halfOpenMaxConcurrent!;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return this.halfOpenRequests < this.circuitBreakerOptions.halfOpenMaxConcurrent!;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.CLOSED;
      this.failureCount = 0;
      this.halfOpenRequests = 0;
      this.logger.info(`Circuit is now closed for ${this.options.baseUrl}`);
    } else if (this.circuitState === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.circuitBreakerOptions.resetTimeout;
      this.halfOpenRequests = 0;
      this.logger.error(
        `Circuit is open again for ${this.options.baseUrl} until ${new Date(this.nextAttempt).toISOString()}`
      );
    } else if (this.circuitState === CircuitState.CLOSED) {
      this.failureCount++;

      if (this.failureCount >= this.circuitBreakerOptions.failureThreshold) {
        this.circuitState = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.circuitBreakerOptions.resetTimeout;
        this.logger.error(
          `Circuit is now open for ${this.options.baseUrl} until ${new Date(this.nextAttempt).toISOString()}`
        );
      }
    }
  }

  /**
   * Calculate retry delay
   */
  private getRetryDelay(retryCount: number): number {
    const { initialRetryDelay, maxRetryDelay, useExponentialBackoff } = this.options;

    if (useExponentialBackoff) {
      // Exponential backoff with jitter
      const expDelay = initialRetryDelay! * Math.pow(2, retryCount);
      const jitter = Math.random() * 0.2 * expDelay; // 20% jitter
      return Math.min(expDelay + jitter, maxRetryDelay!);
    } else {
      // Linear delay
      return Math.min(initialRetryDelay! * (retryCount + 1), maxRetryDelay!);
    }
  }

  /**
   * Execute a request with retries and circuit breaking
   */
  private async executeWithRetry<T>(
    method: string,
    url: string,
    config: AxiosRequestConfig = {},
    data?: unknown
  ): Promise<AxiosResponse<T>> {
    // Check if circuit allows this request
    if (!this.canRequest()) {
      const err = new Error(`Circuit is open for ${this.options.baseUrl}`);
      err.name = 'CircuitOpenError';
      throw err;
    }

    // Increment half-open requests if applicable
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.halfOpenRequests++;
    }

    let retries = 0;
    const maxRetries = this.options.maxRetries!;

    while (true) {
      try {
        let response;
        switch (method.toLowerCase()) {
          case 'get':
            response = await this.axiosInstance.get<T>(url, config);
            break;
          case 'post':
            response = await this.axiosInstance.post<T>(url, data, config);
            break;
          case 'put':
            response = await this.axiosInstance.put<T>(url, data, config);
            break;
          case 'delete':
            response = await this.axiosInstance.delete<T>(url, config);
            break;
          default:
            throw new Error(`Unsupported method: ${method}`);
        }

        // Record success and return response
        this.recordSuccess();
        return response;
      } catch (error) {
        // Decrement half-open requests if applicable
        if (this.circuitState === CircuitState.HALF_OPEN) {
          this.halfOpenRequests--;
        }

        // Check if we should retry
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable || retries >= maxRetries) {
          // Record failure and rethrow
          this.recordFailure();
          throw error;
        }

        // Calculate delay and wait
        const delay = this.getRetryDelay(retries);
        this.logger.debug(
          `Retrying ${method} ${url} after ${delay}ms (${retries + 1}/${maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));

        // Increment retry counter
        retries++;
      }
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    // Type guard to check if error has the expected shape
    const isErrorWithResponse = (err: unknown): err is { response?: { status: number } } => {
      return typeof err === 'object' && err !== null;
    };

    // Check if error matches our expected shape
    if (!isErrorWithResponse(error)) {
      // For completely unknown errors, assume they're network related and retryable
      return true;
    }

    // Network errors are retryable
    if (!error.response) {
      return true;
    }

    // Only retry on certain status codes
    const statusCode = error.response.status;
    return statusCode >= 500 || statusCode === 429;
  }

  /**
   * Make a GET request
   */
  public async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry<T>('get', url, config);
  }

  /**
   * Make a POST request
   */
  public async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry<T>('post', url, config, data);
  }

  /**
   * Make a PUT request
   */
  public async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry<T>('put', url, config, data);
  }

  /**
   * Make a DELETE request
   */
  public async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry<T>('delete', url, config);
  }

  /**
   * Get circuit breaker state
   */
  public getCircuitState(): {
    state: CircuitState;
    failureCount: number;
    nextAttempt?: Date;
  } {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      nextAttempt: this.circuitState === CircuitState.OPEN ? new Date(this.nextAttempt) : undefined,
    };
  }
}

/**
 * Create a service communication client
 */
export function createServiceClient(
  options: ServiceCommunicationOptions,
  circuitBreakerOptions?: CircuitBreakerOptions
): ServiceCommunicationClient {
  return new ServiceCommunicationClient(options, circuitBreakerOptions);
}

/**
 * Factory to create clients for all services
 */
export class ServiceClientFactory {
  private options: Record<string, ServiceCommunicationOptions>;
  private clients: Record<string, ServiceCommunicationClient> = {};

  /**
   * Create a new service client factory
   */
  constructor(options: Record<string, ServiceCommunicationOptions>) {
    this.options = options;
  }

  /**
   * Get a client for a service
   */
  public getClient(serviceName: string): ServiceCommunicationClient {
    if (!this.clients[serviceName]) {
      if (!this.options[serviceName]) {
        throw new Error(`Service configuration not found for: ${serviceName}`);
      }

      this.clients[serviceName] = new ServiceCommunicationClient(this.options[serviceName]);
    }

    return this.clients[serviceName];
  }
}
