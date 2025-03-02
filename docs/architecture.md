# OmniSight Architecture Documentation

## System Architecture Overview

OmniSight is designed as a microservices-based system with six core services that work together to provide a complete Network Video Recorder (NVR) solution.

```
                                  +----------------+
                                  |                |
                                  |  API Gateway   |
                                  |                |
                                  +--------+-------+
                                           |
                                           v
          +------------+    +------------+    +------------+    +------------+
          |            |    |            |    |            |    |            |
          |   Stream   |    | Recording  |    |  Object    |    | Metadata & |
          | Ingestion  |<-->|  Service   |<-->| Detection  |<-->|  Events    |
          |  Service   |    |            |    |  Service   |    |  Service   |
          |            |    |            |    |            |    |            |
          +------------+    +------------+    +------------+    +------------+
                 ^                                                    ^
                 |                                                    |
                 v                                                    v
          +------------+                                       +------------+
          |            |                                       |            |
          |  Camera    |                                       | PostgreSQL |
          |  Streams   |                                       |  Database  |
          |            |                                       |            |
          +------------+                                       +------------+
                                           ^
                                           |
                                           v
                                  +----------------+
                                  |                |
                                  |   Frontend     |
                                  |   Service      |
                                  |                |
                                  +----------------+
```

## Service Descriptions

### 1. Stream Ingestion Service

**Purpose**: Accept and process RTSP streams from security cameras.

**Key Responsibilities**:
- Connect to camera RTSP streams
- Authenticate to camera streams
- Process video streams using FFmpeg
- Distribute video frames to other services
- Monitor stream health and handle reconnections

**Technologies**:
- Node.js with TypeScript
- node-rtsp-stream or similar libraries
- FFmpeg for stream processing
- Message queue for frame distribution

### 2. Recording Service

**Purpose**: Record video streams to storage with efficient segmentation.

**Key Responsibilities**:
- Receive video frames from the ingestion service
- Write frames to storage using FFmpeg
- Implement video segmentation (e.g., 10-minute chunks)
- Manage file organization and naming
- Implement retention policies and storage rotation

**Technologies**:
- Node.js with TypeScript
- fluent-ffmpeg or similar
- File system operations for storage management

### 3. Object Detection Service

**Purpose**: Process video frames for motion and object detection.

**Key Responsibilities**:
- Analyze video frames for motion detection
- Perform object detection (people, vehicles, etc.)
- Generate metadata about detected objects
- Utilize worker threads for parallel processing

**Technologies**:
- Node.js with TypeScript
- TensorFlow.js for Node.js (@tensorflow/tfjs-node)
- Worker threads for parallel processing

### 4. Metadata & Events Service

**Purpose**: Store and manage metadata, events, and configuration.

**Key Responsibilities**:
- Store detection events and video metadata
- Provide RESTful API for events and recordings
- Handle event notifications through WebSockets
- Manage camera configuration data
- Store system state and service health information

**Technologies**:
- Node.js with TypeScript
- PostgreSQL database
- Sequelize ORM for database interactions
- Express.js for RESTful API
- Socket.io for WebSockets

### 5. Frontend Service

**Purpose**: Provide a user interface for monitoring, playback, and configuration.

**Key Responsibilities**:
- Display live video streams
- Provide video playback with timeline navigation
- Offer configuration management UI
- Present event browsing and filtering interface

**Technologies**:
- React with TypeScript
- Modern CSS frameworks
- Video.js or similar for video playback
- WebSockets for real-time updates

### 6. API Gateway

**Purpose**: Serve as a unified entry point for frontend and external integrations.

**Key Responsibilities**:
- Route requests to appropriate microservices
- Handle authentication and authorization
- Provide rate limiting and security features
- Offer API documentation

**Technologies**:
- Node.js with TypeScript
- Express.js
- JWT for authentication
- Swagger/OpenAPI for documentation

## Communication Patterns

### Inter-Service Communication

```
+----------------+                +----------------+
|                |  REST API      |                |
|  Service A     +--------------->+  Service B     |
|                |                |                |
+----------------+                +----------------+

+----------------+                +----------------+
|                |  Message Queue |                |
|  Service A     +--------------->+  Service B     |
|                |                |                |
+----------------+                +----------------+

+----------------+                +----------------+
|                |  WebSockets    |                |
|  Service A     +<-------------->+  Frontend      |
|                |                |                |
+----------------+                +----------------+
```

1. **REST APIs**:
   - Used for request/response patterns between services
   - Synchronous communication for CRUD operations
   - Implemented using Express.js with TypeScript interfaces

2. **Message Queue**:
   - Used for video frame distribution
   - Asynchronous communication for high-volume data
   - Options include RabbitMQ or Redis

3. **WebSockets**:
   - Used for real-time updates to the frontend
   - Bidirectional communication for events and status updates
   - Implemented using Socket.io

## Database Design

### Entity Relationship Diagram (ERD)

```
+---------------+       +---------------+       +---------------+
|               |       |               |       |               |
|    Camera     +-------+   Recording   +-------+    Event      |
|               |       |               |       |               |
+-------+-------+       +-------+-------+       +-------+-------+
        |                       |                       |
        |                       |                       |
        v                       v                       v
+---------------+       +---------------+       +---------------+
|               |       |               |       |               |
|    Stream     |       |    Segment    |       | DetectedObject|
|               |       |               |       |               |
+---------------+       +---------------+       +---------------+
```

### Key Entities and Relationships

1. **Camera**:
   - Properties: id, name, rtspUrl, username, password, status, createdAt, updatedAt
   - Relationships: hasMany Stream, hasMany Recording

2. **Stream**:
   - Properties: id, cameraId, status, startedAt, endedAt, createdAt, updatedAt
   - Relationships: belongsTo Camera, hasMany Segment

3. **Recording**:
   - Properties: id, cameraId, startTime, endTime, duration, status, createdAt, updatedAt
   - Relationships: belongsTo Camera, hasMany Segment, hasMany Event

4. **Segment**:
   - Properties: id, recordingId, streamId, filePath, startTime, endTime, duration, fileSize, createdAt, updatedAt
   - Relationships: belongsTo Recording, belongsTo Stream

5. **Event**:
   - Properties: id, recordingId, timestamp, type, confidence, metadata, createdAt, updatedAt
   - Relationships: belongsTo Recording, hasMany DetectedObject

6. **DetectedObject**:
   - Properties: id, eventId, type, confidence, boundingBox, metadata, createdAt, updatedAt
   - Relationships: belongsTo Event

## Deployment Architecture

### Docker Compose Setup

```
+---------------------------------------+
|                                       |
|           Docker Network              |
|                                       |
| +-------------+     +-------------+   |
| |             |     |             |   |
| | API Gateway |     | Frontend    |   |
| | Container   |     | Container   |   |
| |             |     |             |   |
| +-------------+     +-------------+   |
|                                       |
| +-------------+     +-------------+   |
| |             |     |             |   |
| | Stream      |     | Recording   |   |
| | Ingestion   |     | Container   |   |
| | Container   |     |             |   |
| +-------------+     +-------------+   |
|                                       |
| +-------------+     +-------------+   |
| |             |     |             |   |
| | Object      |     | Metadata &  |   |
| | Detection   |     | Events      |   |
| | Container   |     | Container   |   |
| +-------------+     +-------------+   |
|                                       |
| +-------------+     +-------------+   |
| |             |     |             |   |
| | PostgreSQL  |     | Message     |   |
| | Container   |     | Queue       |   |
| |             |     | Container   |   |
| +-------------+     +-------------+   |
|                                       |
+---------------------------------------+
```

### Volume Mounts

- PostgreSQL data: `/var/lib/postgresql/data`
- Recordings: `/opt/omnisight/recordings`
- Configuration: `/opt/omnisight/config`

## Security Considerations

1. **Authentication and Authorization**:
   - JWT-based authentication
   - Role-based access control
   - Secure credential storage

2. **Network Security**:
   - HTTPS for all communications
   - Internal service communication over private network
   - Firewall rules to restrict access

3. **Data Security**:
   - Encrypted storage for sensitive data
   - Secure database connections
   - Input validation and sanitization

## Scalability Considerations

1. **Horizontal Scaling**:
   - Each microservice can be scaled independently
   - Stateless design for API Gateway and processing services

2. **Vertical Scaling**:
   - Object Detection Service can utilize more powerful hardware
   - Database can be scaled with more resources

3. **Load Balancing**:
   - API Gateway can distribute load across service instances
   - Database read replicas for query-heavy operations

## Monitoring and Logging

1. **Centralized Logging**:
   - Structured logging with Winston or Pino
   - Log aggregation with ELK stack or similar

2. **Metrics Collection**:
   - Prometheus endpoints for each service
   - Grafana dashboards for visualization

3. **Health Checks**:
   - Each service exposes a health check endpoint
   - Docker health checks for container monitoring