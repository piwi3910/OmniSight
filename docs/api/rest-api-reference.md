# OmniSight API Reference Documentation

## Overview

The OmniSight API follows REST principles and provides programmatic access to the OmniSight video surveillance system. This comprehensive reference documentation outlines all available endpoints, request parameters, response formats, and authentication requirements.

## Base URL

All API URLs referenced in this documentation have the following base:

```
https://your-omnisight-server/api
```

Replace `your-omnisight-server` with your actual server domain or IP address.

## Authentication

### JWT Authentication

OmniSight uses JSON Web Tokens (JWT) for API authentication. To access protected endpoints, include the JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Obtaining a Token

To obtain a JWT token, use the authentication endpoint:

```http
POST /auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
```

### Refreshing a Token

When a token is about to expire, use the refresh endpoint:

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Error Handling

All errors follow a standardized format:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)",
  "code": 123 // Optional error code
}
```

## API Endpoints

### Cameras

#### List Cameras

```http
GET /cameras
```

**Query Parameters:**
- `status` (optional): Filter by camera status (online, offline, all)
- `location` (optional): Filter by camera location

**Response:**

```json
{
  "cameras": [
    {
      "id": "camera-uuid",
      "name": "Front Door Camera",
      "ip": "192.168.1.100",
      "port": 554,
      "username": "admin",
      "status": "online",
      "location": "Front Entrance",
      "model": "Hikvision DS-2CD2032",
      "ptzEnabled": true,
      "createdAt": "2025-01-15T12:00:00Z",
      "lastSeen": "2025-03-02T18:30:00Z"
    },
    // More cameras...
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

#### Get Camera Details

```http
GET /cameras/{cameraId}
```

**Response:**

```json
{
  "id": "camera-uuid",
  "name": "Front Door Camera",
  "ip": "192.168.1.100",
  "port": 554,
  "username": "admin",
  "password": "********", // Password is masked
  "status": "online",
  "location": "Front Entrance",
  "model": "Hikvision DS-2CD2032",
  "ptzEnabled": true,
  "streamUrls": {
    "rtsp": "rtsp://192.168.1.100:554/stream",
    "http": "http://192.168.1.100:8080/stream",
    "hls": "/streams/camera-uuid/index.m3u8"
  },
  "createdAt": "2025-01-15T12:00:00Z",
  "lastSeen": "2025-03-02T18:30:00Z",
  "recordings": {
    "count": 156,
    "totalDuration": 9360, // In minutes
    "oldestRecording": "2025-02-01T00:00:00Z",
    "latestRecording": "2025-03-02T23:59:59Z"
  }
}
```

#### Create Camera

```http
POST /cameras
Content-Type: application/json

{
  "name": "Back Yard Camera",
  "ip": "192.168.1.101",
  "port": 554,
  "username": "admin",
  "password": "secure-password",
  "location": "Back Yard",
  "model": "Hikvision DS-2CD2032",
  "ptzEnabled": false
}
```

**Response:**

```json
{
  "id": "new-camera-uuid",
  "name": "Back Yard Camera",
  "status": "pending",
  "createdAt": "2025-03-03T15:30:00Z"
}
```

#### Update Camera

```http
PUT /cameras/{cameraId}
Content-Type: application/json

{
  "name": "Updated Camera Name",
  "location": "New Location"
}
```

#### Delete Camera

```http
DELETE /cameras/{cameraId}
```

#### Camera Stream

```http
GET /cameras/{cameraId}/stream
```

Returns an HLS stream URL or WebRTC connection details.

#### Camera PTZ Controls

```http
POST /cameras/{cameraId}/ptz/move
Content-Type: application/json

{
  "pan": 10,   // -100 to 100
  "tilt": -5,  // -100 to 100
  "zoom": 2,   // 0 to 10
  "continuous": false
}
```

##### Get PTZ Presets

```http
GET /cameras/{cameraId}/ptz/presets
```

##### Save PTZ Preset

```http
POST /cameras/{cameraId}/ptz/presets
Content-Type: application/json

{
  "name": "Front Door View",
  "position": {
    "pan": 10,
    "tilt": -5,
    "zoom": 2
  }
}
```

##### Go to PTZ Preset

```http
POST /cameras/{cameraId}/ptz/goto-preset
Content-Type: application/json

{
  "presetId": "preset-uuid"
}
```

##### Delete PTZ Preset

```http
DELETE /cameras/{cameraId}/ptz/presets/{presetId}
```

### Recordings

#### List Recordings

```http
GET /recordings
```

**Query Parameters:**
- `cameraId` (optional): Filter by camera
- `startTime` (optional): Filter by start time (ISO 8601 format)
- `endTime` (optional): Filter by end time (ISO 8601 format)
- `duration` (optional): Filter by minimum duration in seconds
- `hasEvents` (optional): Filter recordings with events (true/false)
- `page` (optional): Page number for pagination
- `limit` (optional): Number of recordings per page

**Response:**

```json
{
  "recordings": [
    {
      "id": "recording-uuid",
      "cameraId": "camera-uuid",
      "cameraName": "Front Door Camera",
      "startTime": "2025-03-02T14:00:00Z",
      "endTime": "2025-03-02T15:00:00Z",
      "duration": 3600,
      "size": 1572864000, // In bytes
      "segmentCount": 6,
      "thumbnailUrl": "/thumbnails/recording-uuid.jpg",
      "eventCount": 12
    },
    // More recordings...
  ],
  "total": 156,
  "page": 1,
  "limit": 20
}
```

#### Get Recording Details

```http
GET /recordings/{recordingId}
```

**Response:**

```json
{
  "id": "recording-uuid",
  "cameraId": "camera-uuid",
  "cameraName": "Front Door Camera",
  "startTime": "2025-03-02T14:00:00Z",
  "endTime": "2025-03-02T15:00:00Z",
  "duration": 3600,
  "size": 1572864000,
  "status": "complete",
  "segments": [
    {
      "id": "segment-1",
      "startTime": "2025-03-02T14:00:00Z",
      "endTime": "2025-03-02T14:10:00Z",
      "duration": 600,
      "size": 262144000,
      "path": "/segments/segment-1.mp4",
      "thumbnailUrl": "/thumbnails/segment-1.jpg"
    },
    // More segments...
  ],
  "events": [
    {
      "id": "event-uuid",
      "timestamp": "2025-03-02T14:05:23Z",
      "type": "motion",
      "confidence": 95,
      "thumbnailUrl": "/thumbnails/event-uuid.jpg"
    },
    // More events...
  ]
}
```

#### Start Recording

```http
POST /recordings/start
Content-Type: application/json

{
  "cameraId": "camera-uuid",
  "duration": 3600 // Optional, in seconds
}
```

#### Stop Recording

```http
POST /recordings/stop
Content-Type: application/json

{
  "cameraId": "camera-uuid"
}
```

#### Delete Recording

```http
DELETE /recordings/{recordingId}
```

#### Export Recording

```http
POST /recordings/{recordingId}/export
Content-Type: application/json

{
  "format": "mp4",
  "startTime": "2025-03-02T14:05:00Z", // Optional
  "endTime": "2025-03-02T14:15:00Z",   // Optional
  "includeEvents": true,               // Optional
  "watermark": {                       // Optional
    "text": "OmniSight Export",
    "position": "bottom-right",
    "opacity": 0.7
  }
}
```

**Response:**

```json
{
  "exportId": "export-uuid",
  "status": "processing",
  "estimatedCompletionTime": "2025-03-03T15:45:00Z"
}
```

### Events

#### List Events

```http
GET /events
```

**Query Parameters:**
- `cameraId` (optional): Filter by camera
- `recordingId` (optional): Filter by recording
- `startTime` (optional): Filter by start time (ISO 8601 format)
- `endTime` (optional): Filter by end time (ISO 8601 format)
- `type` (optional): Filter by event type (motion, person, vehicle, etc.)
- `minConfidence` (optional): Filter by minimum confidence level (0-100)
- `objectTypes` (optional): Filter by detected object types (comma-separated)
- `metadata` (optional): Filter by metadata (JSON string)
- `page` (optional): Page number for pagination
- `limit` (optional): Number of events per page

**Response:**

```json
{
  "events": [
    {
      "id": "event-uuid",
      "timestamp": "2025-03-02T14:05:23Z",
      "type": "person",
      "confidence": 95,
      "cameraId": "camera-uuid",
      "cameraName": "Front Door Camera",
      "recordingId": "recording-uuid",
      "thumbnailPath": "/thumbnails/event-uuid.jpg",
      "detectedObjects": [
        {
          "id": "object-uuid",
          "type": "person",
          "confidence": 95,
          "boundingBox": {
            "x": 0.2,
            "y": 0.3,
            "width": 0.1,
            "height": 0.4
          }
        }
      ],
      "createdAt": "2025-03-02T14:05:24Z"
    },
    // More events...
  ],
  "pagination": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

#### Get Event Details

```http
GET /events/{eventId}
```

**Response:**

```json
{
  "id": "event-uuid",
  "timestamp": "2025-03-02T14:05:23Z",
  "type": "person",
  "confidence": 95,
  "camera": {
    "id": "camera-uuid",
    "name": "Front Door Camera",
    "location": "Front Entrance"
  },
  "recording": {
    "id": "recording-uuid",
    "startTime": "2025-03-02T14:00:00Z",
    "endTime": "2025-03-02T15:00:00Z"
  },
  "thumbnailPath": "/thumbnails/event-uuid.jpg",
  "detectedObjects": [
    {
      "id": "object-uuid",
      "type": "person",
      "confidence": 95,
      "boundingBox": {
        "x": 0.2,
        "y": 0.3,
        "width": 0.1,
        "height": 0.4
      }
    }
  ],
  "metadata": {
    "direction": "entering",
    "speed": "walking",
    "color": "red"
  },
  "createdAt": "2025-03-02T14:05:24Z",
  "updatedAt": "2025-03-02T14:05:24Z"
}
```

#### Advanced Event Search

```http
GET /events/search
```

Complex search with multiple object types, time ranges, etc.

**Query Parameters:**
- `objectTypes` (required): Comma-separated list of object types
- `startTime` (optional): Start time in ISO format
- `endTime` (optional): End time in ISO format
- `minConfidence` (optional): Minimum confidence threshold
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**

```json
{
  "events": [
    // Array of events as above
  ],
  "search": {
    "objectTypes": ["person", "vehicle"],
    "startTime": "2025-03-01T00:00:00Z",
    "endTime": "2025-03-03T00:00:00Z",
    "minConfidence": 80
  },
  "pagination": {
    "total": 35,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

#### Export Events

```http
GET /events/export
```

Export events matching the specified filters to CSV or JSON format.

**Query Parameters:**
- Same as for list events, plus:
- `format` (optional): Export format (csv, json) - Default: json

#### Get Event Counts by Type

```http
GET /events/counts
```

Get aggregated event counts by type within a time range.

**Query Parameters:**
- `startTime` (optional): Start time in ISO format
- `endTime` (optional): End time in ISO format

**Response:**

```json
{
  "counts": {
    "motion": 234,
    "person": 87,
    "vehicle": 42,
    "face": 15,
    "animal": 8
  },
  "timeRange": {
    "startTime": "2025-03-01T00:00:00Z",
    "endTime": "2025-03-03T00:00:00Z"
  }
}
```

### System

#### Get System Status

```http
GET /system/status
```

**Response:**

```json
{
  "status": "healthy",
  "uptime": 1209600, // In seconds
  "version": "1.2.3",
  "cpuUsage": 32.5,
  "memoryUsage": 68.2,
  "diskUsage": 75.8,
  "services": [
    {
      "name": "api-gateway",
      "status": "healthy",
      "uptime": 1209600
    },
    {
      "name": "stream-ingestion",
      "status": "healthy",
      "uptime": 1209600
    },
    {
      "name": "recording",
      "status": "healthy",
      "uptime": 1209500
    },
    {
      "name": "object-detection",
      "status": "healthy",
      "uptime": 1209400
    },
    {
      "name": "metadata-events",
      "status": "healthy",
      "uptime": 1209600
    }
  ],
  "activeCameras": 10,
  "activeStreams": 8,
  "storage": {
    "total": 1099511627776, // 1TB in bytes
    "used": 834666325196,   // Used space in bytes
    "available": 264845302580, // Available space in bytes
    "recordings": {
      "size": 774666325196,
      "count": 5243
    },
    "backups": {
      "size": 60000000000,
      "count": 5
    }
  }
}
```

#### Get System Logs

```http
GET /system/logs
```

**Query Parameters:**
- `service` (optional): Filter by service name
- `level` (optional): Filter by log level (info, warn, error)
- `startTime` (optional): Filter by start time
- `endTime` (optional): Filter by end time
- `limit` (optional): Number of logs to return
- `page` (optional): Page number for pagination

**Response:**

```json
{
  "logs": [
    {
      "timestamp": "2025-03-02T14:05:23Z",
      "service": "stream-ingestion",
      "level": "info",
      "message": "Camera connected: Front Door Camera",
      "metadata": {
        "cameraId": "camera-uuid",
        "ip": "192.168.1.100"
      }
    },
    // More logs...
  ],
  "total": 1256,
  "page": 1,
  "limit": 20
}
```

#### Backup System

```http
POST /system/backup
Content-Type: application/json

{
  "includeRecordings": false,
  "includeEvents": true,
  "includeSettings": true
}
```

**Response:**

```json
{
  "backupId": "backup-uuid",
  "status": "processing",
  "estimatedCompletionTime": "2025-03-03T15:45:00Z"
}
```

#### Restore System

```http
POST /system/restore
Content-Type: application/json

{
  "backupId": "backup-uuid"
}
```

## WebSocket API

The OmniSight system also provides a WebSocket API for real-time events and notifications.

### WebSocket Connection

Connect to the WebSocket endpoint with your JWT token:

```
ws://your-omnisight-server/ws?token=your-jwt-token
```

### Event Types

The WebSocket API sends events in the following format:

```json
{
  "type": "event-type",
  "data": { /* event data */ },
  "timestamp": "2025-03-02T14:05:23Z"
}
```

#### Event Detection

```json
{
  "type": "detection",
  "data": {
    "id": "event-uuid",
    "cameraId": "camera-uuid",
    "cameraName": "Front Door Camera",
    "eventType": "person",
    "confidence": 95,
    "thumbnailUrl": "/thumbnails/event-uuid.jpg",
    "objects": [
      {
        "type": "person",
        "confidence": 95,
        "boundingBox": {
          "x": 0.2,
          "y": 0.3,
          "width": 0.1,
          "height": 0.4
        }
      }
    ]
  },
  "timestamp": "2025-03-02T14:05:23Z"
}
```

#### Camera Status Change

```json
{
  "type": "camera-status",
  "data": {
    "cameraId": "camera-uuid",
    "cameraName": "Front Door Camera",
    "status": "online",
    "previousStatus": "offline"
  },
  "timestamp": "2025-03-02T14:05:23Z"
}
```

#### Recording Status Change

```json
{
  "type": "recording-status",
  "data": {
    "recordingId": "recording-uuid",
    "cameraId": "camera-uuid",
    "cameraName": "Front Door Camera",
    "status": "complete",
    "previousStatus": "recording",
    "startTime": "2025-03-02T14:00:00Z",
    "endTime": "2025-03-02T15:00:00Z"
  },
  "timestamp": "2025-03-02T15:00:01Z"
}
```

#### System Alert

```json
{
  "type": "system-alert",
  "data": {
    "level": "warning",
    "message": "Storage space running low (15% remaining)",
    "service": "recording"
  },
  "timestamp": "2025-03-02T15:30:00Z"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse. Rate limits are applied per user and vary by endpoint.

Standard rate limits:
- Authentication endpoints: 10 requests per minute
- Regular API endpoints: 60 requests per minute
- WebSocket connections: 5 connections per user

When a rate limit is exceeded, the API returns a 429 Too Many Requests status code with a Retry-After header indicating when the client can retry.

## Versioning

The API version is specified in the URL path:

```
https://your-omnisight-server/api/v1/cameras
```

When an API is updated with breaking changes, a new version is released, and the old version is maintained for backward compatibility for a specified deprecation period.