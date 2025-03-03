# Health Checks and Service Monitoring

This document outlines the health check and monitoring system implemented in the OmniSight platform.

## Overview

OmniSight implements a comprehensive health check system that provides:

1. **Real-time Health Status** - Each service provides endpoints that report its operational status
2. **Dependency Monitoring** - Services check the health of their dependencies (database, queue, other services)
3. **Automatic Circuit Breaking** - Failing services are detected and traffic is diverted
4. **Kubernetes-compatible** - Compatible with Kubernetes liveness and readiness probes
5. **Dashboard Integration** - Health data can be visualized in operational dashboards

## Health Check Endpoints

Each service provides the following health check endpoints:

| Endpoint | Description | Example Response |
|----------|-------------|-----------------|
| `/health` | Complete health check with all dependencies | Detailed JSON with service status and dependencies |
| `/health/liveness` | Simplified health check for Kubernetes liveness probe | `{"status":"ok","service":"api-gateway","timestamp":"2025-03-03T12:00:00Z"}` |
| `/health/readiness` | Dependency check for Kubernetes readiness probe | `{"status":"ok","service":"api-gateway","timestamp":"2025-03-03T12:00:00Z","dependencies":{...}}` |

## Health Status Values

Services report their health status using one of three values:

| Status | Description |
|--------|-------------|
| `ok` | Service is functioning normally |
| `degraded` | Service is functioning but with some issues |
| `error` | Service is not functioning correctly |

## Health Check Response Format

The health check endpoint returns a JSON object with the following structure:

```json
{
  "status": "ok",
  "service": "api-gateway",
  "version": "1.0.0",
  "timestamp": "2025-03-03T12:00:00Z",
  "requestId": "5f8d9a6b-3c4d-4e5f-8g9h-0i1j2k3l4m5n",
  "uptime": 3600,
  "memory": {
    "used": 256.5,
    "total": 1024.0,
    "free": 767.5,
    "usagePercent": 25.05
  },
  "cpu": {
    "cores": 4,
    "loadAvg": [0.5, 0.6, 0.7]
  },
  "dependencies": {
    "database": {
      "status": "ok",
      "type": "database",
      "responseTime": 15,
      "details": {
        "responseTimeMs": 15
      }
    },
    "rabbitmq": {
      "status": "ok",
      "type": "message_queue",
      "responseTime": 5,
      "details": {
        "responseTimeMs": 5
      }
    },
    "metadata-events-service": {
      "status": "ok",
      "type": "service",
      "responseTime": 30,
      "details": {
        "responseTimeMs": 30
      }
    },
    "stream-ingestion-service": {
      "status": "degraded",
      "type": "service",
      "responseTime": 150,
      "details": {
        "status": "degraded",
        "responseTimeMs": 150
      }
    }
  }
}
```

## Implementation

The health check system is implemented using the shared library:

```typescript
import { 
  createHealthCheckManager, 
  commonDependencies 
} from '@omnisight/shared';

// Create health check manager
const healthCheck = createHealthCheckManager({
  serviceName: 'my-service',
  version: '1.0.0',
  dependencies: [
    // Database check
    commonDependencies.createDatabaseCheck({
      name: 'database',
      critical: true,
      checkFn: async () => {
        // Check database connection
        await prisma.$queryRaw`SELECT 1`;
      }
    }),
    
    // RabbitMQ check
    commonDependencies.createRabbitMQCheck({
      name: 'rabbitmq',
      critical: true,
      checkFn: async () => {
        // Check RabbitMQ connection
        await rabbitMQ.checkConnection();
      }
    }),
    
    // Service dependency check
    commonDependencies.createServiceCheck({
      name: 'other-service',
      url: 'http://other-service:3000',
      timeoutMs: 3000
    })
  ]
});

// Start monitoring
healthCheck.startMonitoring();

// Add health check endpoints to Express app
app.use(healthCheck.getHealthCheckRouter());
```

## Circuit Breaking and Service Resilience

The API Gateway implements a circuit breaker pattern that prevents cascading failures:

1. **Health Checking** - The gateway checks service health before proxying requests
2. **Automatic Recovery** - Failed services are retried automatically
3. **Degraded Mode** - Non-critical services can be bypassed when failing
4. **User Feedback** - Appropriate error messages are returned to clients

## Monitoring and Alerts

Health check data can be used for monitoring and alerting:

1. **Health Status Changes** - Logged when service status changes
2. **Critical Dependency Failures** - Immediately logged as errors
3. **Performance Degradation** - Slow response times are tracked
4. **Memory/CPU Monitoring** - Resource usage is tracked over time

## Kubernetes Integration

The health check system is designed to work with Kubernetes:

```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Health Dashboard

The system includes a health dashboard that provides:

1. **Service Status Overview** - Current status of all services
2. **Dependency Graph** - Visual representation of service dependencies
3. **Historical Data** - Status changes over time
4. **Alert History** - Record of past issues

## Future Enhancements

Planned enhancements to the health check system:

1. **Predictive Failure Analysis** - Using trends to predict potential failures
2. **Auto-scaling Integration** - Using health data to inform scaling decisions
3. **Advanced Metrics** - Custom performance metrics for specific services
4. **Geographic Monitoring** - Health status across different regions