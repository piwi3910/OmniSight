# OmniSight Messaging Standards

This document outlines the standardized approach for message queue communication in the OmniSight system.

## Overview

OmniSight uses RabbitMQ for asynchronous communication between services. This allows for decoupling of services, improved scalability, and more resilient system architecture.

## Message Structure

All messages in the system follow a standardized format:

```json
{
  "messageId": "unique-id",
  "type": "message.type",
  "source": "service-name",
  "timestamp": "ISO timestamp",
  "payload": {
    // Message-specific data
  },
  "priority": 5,
  "expiration": 60000,
  "correlationId": "optional-correlation-id",
  "replyTo": "optional-reply-queue",
  "metadata": {
    // Additional metadata
  }
}
```

### Message Fields

| Field | Type | Description |
|-------|------|-------------|
| messageId | string | Unique identifier for the message (UUID v4) |
| type | string | Type of message (from MessageType enum) |
| source | string | Service that sent the message |
| timestamp | string | ISO timestamp when message was created |
| payload | object | Main message payload |
| priority | number (optional) | Message priority (1-10, default 5) |
| expiration | number (optional) | Message expiration in milliseconds |
| correlationId | string (optional) | For request-response pattern |
| replyTo | string (optional) | Reply queue for request-response pattern |
| metadata | object (optional) | Additional metadata |

## Message Types

The system defines a set of standardized message types:

### Stream Events

| Type | Description | Publisher | Consumer |
|------|-------------|-----------|----------|
| `stream.started` | Stream has started | Stream Ingestion | Recording, Object Detection, Metadata & Events |
| `stream.stopped` | Stream has stopped | Stream Ingestion | Recording, Object Detection, Metadata & Events |
| `stream.error` | Error with stream | Stream Ingestion | Metadata & Events |
| `stream.frame` | Video frame from stream | Stream Ingestion | Recording, Object Detection |

### Recording Events

| Type | Description | Publisher | Consumer |
|------|-------------|-----------|----------|
| `recording.started` | Recording has started | Recording | Metadata & Events |
| `recording.stopped` | Recording has stopped | Recording | Metadata & Events |
| `recording.segment.created` | New segment created | Recording | Metadata & Events |
| `recording.error` | Error with recording | Recording | Metadata & Events |

### Detection Events

| Type | Description | Publisher | Consumer |
|------|-------------|-----------|----------|
| `detection.started` | Detection has started | Object Detection | Metadata & Events |
| `detection.completed` | Detection process completed | Object Detection | Metadata & Events |
| `object.detected` | Object detected in frame | Object Detection | Metadata & Events |
| `detection.error` | Error with detection | Object Detection | Metadata & Events |

### System Events

| Type | Description | Publisher | Consumer |
|------|-------------|-----------|----------|
| `system.alert` | System alert | Any | API Gateway |
| `system.health` | Health check | Any | API Gateway |
| `system.config.updated` | Configuration updated | API Gateway | All |

## Exchange and Queue Structure

### Main Exchanges

| Exchange | Type | Description |
|----------|------|-------------|
| `events` | topic | For all event-related messages |
| `streams` | topic | For stream-related messages |
| `recordings` | topic | For recording-related messages |
| `detection` | topic | For detection-related messages |
| `system` | topic | For system-related messages |
| `dead-letter` | fanout | For failed messages |

### Routing Keys

Messages are routed using keys following the pattern:

`service.resource.action`

Examples:
- `stream.camera.started`
- `recording.segment.created`
- `detection.object.person`

### Queue Bindings

Each service binds its queues to the relevant exchanges with appropriate routing keys:

```
recording-service.stream-frames <- streams : stream.*.frame
metadata-service.events <- events : #
```

## Error Handling

### Dead Letter Exchange

Messages that cannot be processed are sent to the dead-letter exchange. Each service should establish a queue bound to this exchange to monitor for failed messages.

### Retry Strategy

1. **Initial Retry**: Failed messages are retried immediately if it's the first failure.
2. **Exponential Backoff**: Subsequent retries use exponential backoff.
3. **Max Retries**: After maximum retries (default: 3), message is sent to dead-letter.

## Message Priority

Messages can have priority levels:

| Priority | Level | Use Case |
|----------|-------|----------|
| 1-3 | Low | Background tasks, non-urgent events |
| 4-6 | Normal | Standard operations (default: 5) |
| 7-9 | High | Important events, time-sensitive operations |
| 10 | Critical | Critical alerts, system errors |

## Connection Management

### Connection Resilience

1. **Auto-reconnect**: Services automatically reconnect to RabbitMQ if the connection is lost.
2. **Exponential Backoff**: Reconnection attempts use exponential backoff.
3. **Max Attempts**: Maximum reconnection attempts before giving up.

### Channel Management

1. **Channel per Operation**: Use separate channels for publishing and consuming.
2. **Channel Recovery**: Automatically recover channels on reconnection.

## Implementation

The standardized RabbitMQ client implementation is provided in the shared library:

```typescript
import { 
  createRabbitMQManager, 
  MessageType, 
  MessagePriority 
} from '@omnisight/shared';

// Create RabbitMQ manager
const rabbitmq = createRabbitMQManager({
  url: config.rabbitmq.url,
  serviceName: 'my-service',
  logger: logger
});

// Connect and set up exchanges
await rabbitmq.connect();
await rabbitmq.setupTopology();

// Publish a message
await rabbitmq.publish(
  'events',
  'object.detected.person',
  rabbitmq.createMessage(
    MessageType.OBJECT_DETECTED,
    {
      detectionId: '123',
      cameraId: '456',
      timestamp: new Date().toISOString(),
      objects: [/* detected objects */]
    },
    { priority: MessagePriority.HIGH }
  )
);

// Consume messages
await rabbitmq.bindQueue(
  'my-service.object-events',
  'events',
  'object.detected.*'
);

await rabbitmq.consume(
  'my-service.object-events',
  async (message) => {
    console.log('Received message:', message);
    // Process message
  }
);
```

## Best Practices

1. **Durable Messages**: Always use durable messages for important operations.
2. **Content Type**: Include content type in message properties.
3. **Correlation IDs**: Use correlation IDs for tracking related messages.
4. **Message Size**: Keep messages small (<1MB). Use references for large data.
5. **Circuit Breaking**: Implement circuit breakers for publishing.
6. **Prefetch**: Set appropriate prefetch counts based on processing capacity.
7. **Monitoring**: Monitor queue depths and processing times.