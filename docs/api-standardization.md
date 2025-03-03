# API Standardization and Service Communication

This document outlines the standardized approach for API endpoints, error handling, WebSocket communication, and service-to-service interaction in the OmniSight system.

## API Endpoint Structure

All API endpoints follow this hierarchical structure:

```
/api/v1/{resource}/{id}/{sub-resource}
```

### Example Endpoints:

| Endpoint | Description |
|----------|-------------|
| GET /api/v1/cameras | List all cameras |
| GET /api/v1/cameras/{id} | Get camera details |
| GET /api/v1/cameras/{id}/streams | List streams for a camera |
| POST /api/v1/cameras/{id}/stream/start | Start a stream |
| GET /api/v1/recordings/{id}/segments | List segments for a recording |

### Standardized Query Parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number for pagination (starts at 1) |
| limit | number | Number of items per page |
| sort | string | Field to sort by (prefix with - for descending) |
| fields | string | Comma-separated list of fields to include |
| q | string | Search query string |

## Error Response Format

All API errors follow this standard JSON format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field1": "Error details for field1",
      "field2": "Error details for field2"
    }
  }
}
```

### Standard Error Codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request parameters or body |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| RESOURCE_NOT_FOUND | 404 | Requested resource not found |
| CONFLICT | 409 | Request conflicts with server state |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

## WebSocket Communication

### Connection:

WebSocket connections are established at:
```
ws://hostname:port/api/v1/ws
```

Authentication is required via JWT token as a query parameter:
```
ws://hostname:port/api/v1/ws?token=eyJhbGciOiJIUzI1NiIsInR...
```

### Standard WebSocket Events:

| Event Type | Direction | Description |
|------------|-----------|-------------|
| subscribe | Client → Server | Subscribe to a channel |
| unsubscribe | Client → Server | Unsubscribe from a channel |
| event | Server → Client | Event notification |
| camera_status | Server → Client | Camera status update |
| recording_status | Server → Client | Recording status update |
| system_notification | Server → Client | System notification |
| error | Server → Client | Error notification |
| heartbeat | Client → Server | Connection heartbeat |

### Event Payload Schema:

```json
{
  "type": "event_type",
  "timestamp": "ISO timestamp",
  "data": {
    // Event-specific data
  }
}
```

## Service-to-Service Communication

### Direct API Calls:

Services communicate directly via HTTP when:
- Immediate response is required
- Operation is transactional
- Simple request/response pattern

Example:
```typescript
try {
  const response = await axios.post(`${config.metadataService.url}/api/events`, eventData, {
    timeout: 5000,
    headers: { 'X-Service-Name': 'object-detection' }
  });
  return response.data;
} catch (error) {
  // Handle error with retry logic
  if (axios.isAxiosError(error) && error.response?.status === 503) {
    // Retry with exponential backoff
  }
  throw error;
}
```

### Message Queue Communication:

Services use RabbitMQ when:
- Asynchronous processing is acceptable
- High-volume data transfer is needed
- Fire-and-forget notifications are sufficient
- One-to-many distribution is required

Message Schema:
```json
{
  "messageId": "unique-id",
  "source": "service-name",
  "type": "message-type",
  "timestamp": "ISO timestamp",
  "payload": {
    // Message-specific data
  }
}
```

Exchange Types:
- Topic exchange for routing by pattern
- Direct exchange for specific queues
- Fanout exchange for broadcasting

## Error Handling Strategy

### Service-Level Error Handling:

1. **Catch and Log**: All errors are caught and logged with context
2. **Classify**: Errors are classified as operational or programming
3. **Respond**: Return standardized error response
4. **Recover**: Implement recovery strategies for operational errors

### Circuit Breaking:

To prevent cascading failures, services implement circuit breakers for external calls:

```typescript
const circuitBreaker = new CircuitBreaker(
  async () => await axios.get(`${serviceUrl}/endpoint`),
  {
    failureThreshold: 3,
    resetTimeout: 30000,
    fallback: () => defaultResponse
  }
);

try {
  const result = await circuitBreaker.fire();
  return result;
} catch (error) {
  // Handle circuit breaker open or failure
}
```

### Retry Strategies:

Services implement exponential backoff for retryable errors:

```typescript
const executeWithRetry = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || retries >= maxRetries) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
};
```

## Service Boundaries and Route Resolution

To avoid route conflicts between services, the following conventions are used:

| Path Pattern | Responsible Service | Example Endpoint |
|--------------|---------------------|------------------|
| `/users/*` | Metadata & Events | `/api/v1/users/123` |
| `/cameras/*` | Metadata & Events | `/api/v1/cameras/456` |
| `/events/*` | Metadata & Events | `/api/v1/events/789` |
| `/streams/*` | Stream Ingestion | `/api/v1/streams/abc` |
| `/recordings/metadata/*` | Metadata & Events | `/api/v1/recordings/metadata/def` |
| `/recordings/storage/*` | Recording | `/api/v1/recordings/storage/ghi` |
| `/segments/metadata/*` | Metadata & Events | `/api/v1/segments/metadata/jkl` |
| `/segments/storage/*` | Recording | `/api/v1/segments/storage/mno` |
| `/detection/*` | Object Detection | `/api/v1/detection/pqr` |

## Health Check Endpoints

Every service exposes a health check endpoint:

```
GET /health
```

Response:
```json
{
  "status": "ok|degraded|error",
  "service": "service-name",
  "version": "1.0.0",
  "timestamp": "ISO timestamp",
  "dependencies": {
    "database": "ok",
    "rabbitmq": "ok",
    "other-service": "degraded"
  }
}
```

## Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | User login |
| `/auth/register` | POST | User registration |
| `/auth/refresh-token` | POST | Refresh access token |
| `/auth/logout` | POST | Log out user |
| `/users/me` | GET | Get current user info |

## Implementation Status

- [x] Create standardized API documentation
- [x] Update API Gateway to standardize authentication paths
- [x] Update API Gateway to resolve route conflicts between services
- [x] Implement WebSocket proxy and connection management
- [x] Implement consistent error handling middleware
- [x] Implement circuit breakers for service communication
- [ ] Add health check endpoint monitors
- [ ] Standardize RabbitMQ message formats