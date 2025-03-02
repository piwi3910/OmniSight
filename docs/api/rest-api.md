# OmniSight REST API Documentation

This document outlines the REST API endpoints for the OmniSight microservices architecture.

## API Gateway Endpoints

The API Gateway serves as the entry point for all client requests and routes them to the appropriate microservices.

Base URL: `http://localhost:8000/api/v1`

### Authentication

#### Register a new user

```
POST /auth/register
```

Request body:
```json
{
  "username": "user1",
  "email": "user1@example.com",
  "password": "securepassword",
  "role": "user"
}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "user1",
  "email": "user1@example.com",
  "role": "user",
  "createdAt": "2023-01-01T00:00:00.000Z"
}
```

#### Login

```
POST /auth/login
```

Request body:
```json
{
  "email": "user1@example.com",
  "password": "securepassword"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "user1",
    "email": "user1@example.com",
    "role": "user"
  }
}
```

#### Refresh token

```
POST /auth/refresh-token
```

Request body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Logout

```
POST /auth/logout
```

Request body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response:
```json
{
  "message": "Logged out successfully"
}
```

### User Management

#### Get current user

```
GET /users/me
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "user1",
  "email": "user1@example.com",
  "role": "user",
  "lastLogin": "2023-01-01T00:00:00.000Z",
  "settings": {
    "theme": "dark",
    "notifications": true
  }
}
```

#### Update user settings

```
PATCH /users/me/settings
```

Request body:
```json
{
  "settings": {
    "theme": "light",
    "notifications": false
  }
}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "settings": {
    "theme": "light",
    "notifications": false
  }
}
```

#### Get all users (admin only)

```
GET /users
```

Response:
```json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "user1",
      "email": "user1@example.com",
      "role": "user",
      "lastLogin": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "lastLogin": "2023-01-01T00:00:00.000Z"
    }
  ],
  "total": 2
}
```

## Camera Management API

### Get all cameras

```
GET /cameras
```

Query parameters:
- `status` (optional): Filter by camera status (online, offline, error)
- `location` (optional): Filter by camera location
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 10)

Response:
```json
{
  "cameras": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Front Door Camera",
      "rtspUrl": "rtsp://example.com/stream1",
      "status": "online",
      "ipAddress": "192.168.1.100",
      "location": "Front Door",
      "model": "Generic RTSP Camera",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Backyard Camera",
      "rtspUrl": "rtsp://example.com/stream2",
      "status": "offline",
      "ipAddress": "192.168.1.101",
      "location": "Backyard",
      "model": "Generic RTSP Camera",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

### Get camera by ID

```
GET /cameras/:id
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Front Door Camera",
  "rtspUrl": "rtsp://example.com/stream1",
  "username": "admin",
  "password": "******",
  "status": "online",
  "ipAddress": "192.168.1.100",
  "location": "Front Door",
  "model": "Generic RTSP Camera",
  "settings": {
    "resolution": "1080p",
    "framerate": 30
  },
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### Create a new camera

```
POST /cameras
```

Request body:
```json
{
  "name": "Living Room Camera",
  "rtspUrl": "rtsp://example.com/stream3",
  "username": "admin",
  "password": "password123",
  "ipAddress": "192.168.1.102",
  "location": "Living Room",
  "model": "Generic RTSP Camera",
  "settings": {
    "resolution": "1080p",
    "framerate": 30
  }
}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Living Room Camera",
  "rtspUrl": "rtsp://example.com/stream3",
  "status": "offline",
  "ipAddress": "192.168.1.102",
  "location": "Living Room",
  "model": "Generic RTSP Camera",
  "settings": {
    "resolution": "1080p",
    "framerate": 30
  },
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### Update a camera

```
PUT /cameras/:id
```

Request body:
```json
{
  "name": "Living Room Camera Updated",
  "rtspUrl": "rtsp://example.com/stream3_updated",
  "username": "admin",
  "password": "newpassword123",
  "location": "Living Room Corner",
  "settings": {
    "resolution": "720p",
    "framerate": 15
  }
}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "name": "Living Room Camera Updated",
  "rtspUrl": "rtsp://example.com/stream3_updated",
  "status": "offline",
  "ipAddress": "192.168.1.102",
  "location": "Living Room Corner",
  "model": "Generic RTSP Camera",
  "settings": {
    "resolution": "720p",
    "framerate": 15
  },
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### Delete a camera

```
DELETE /cameras/:id
```

Response:
```json
{
  "message": "Camera deleted successfully"
}
```

### Get camera status

```
GET /cameras/:id/status
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "online",
  "lastSeen": "2023-01-01T00:00:00.000Z",
  "streamActive": true,
  "recordingActive": true,
  "detectionActive": true
}
```

### Start camera stream

```
POST /cameras/:id/stream/start
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "streamId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "startedAt": "2023-01-01T00:00:00.000Z",
  "message": "Stream started successfully"
}
```

### Stop camera stream

```
POST /cameras/:id/stream/stop
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "streamId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "inactive",
  "endedAt": "2023-01-01T00:00:00.000Z",
  "message": "Stream stopped successfully"
}
```

## Recording Management API

### Get all recordings

```
GET /recordings
```

Query parameters:
- `cameraId` (optional): Filter by camera ID
- `startTime` (optional): Filter by start time (ISO date string)
- `endTime` (optional): Filter by end time (ISO date string)
- `status` (optional): Filter by recording status
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 10)

Response:
```json
{
  "recordings": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "cameraId": "550e8400-e29b-41d4-a716-446655440000",
      "cameraName": "Front Door Camera",
      "startTime": "2023-01-01T00:00:00.000Z",
      "endTime": "2023-01-01T01:00:00.000Z",
      "duration": 3600,
      "status": "completed",
      "segmentCount": 6,
      "thumbnailPath": "/thumbnails/recording_550e8400.jpg",
      "createdAt": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "cameraId": "550e8400-e29b-41d4-a716-446655440001",
      "cameraName": "Backyard Camera",
      "startTime": "2023-01-01T00:00:00.000Z",
      "endTime": "2023-01-01T01:00:00.000Z",
      "duration": 3600,
      "status": "completed",
      "segmentCount": 6,
      "thumbnailPath": "/thumbnails/recording_550e8400.jpg",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

### Get recording by ID

```
GET /recordings/:id
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "camera": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Front Door Camera",
    "location": "Front Door"
  },
  "startTime": "2023-01-01T00:00:00.000Z",
  "endTime": "2023-01-01T01:00:00.000Z",
  "duration": 3600,
  "status": "completed",
  "segments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "startTime": "2023-01-01T00:00:00.000Z",
      "endTime": "2023-01-01T00:10:00.000Z",
      "duration": 600,
      "filePath": "/recordings/550e8400/segment_1.mp4",
      "fileSize": 15000000,
      "thumbnailPath": "/thumbnails/segment_550e8400_1.jpg"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "startTime": "2023-01-01T00:10:00.000Z",
      "endTime": "2023-01-01T00:20:00.000Z",
      "duration": 600,
      "filePath": "/recordings/550e8400/segment_2.mp4",
      "fileSize": 15000000,
      "thumbnailPath": "/thumbnails/segment_550e8400_2.jpg"
    }
  ],
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2023-01-01T00:05:30.000Z",
      "type": "motion",
      "thumbnailPath": "/thumbnails/event_550e8400.jpg"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "timestamp": "2023-01-01T00:15:45.000Z",
      "type": "person",
      "thumbnailPath": "/thumbnails/event_550e8401.jpg"
    }
  ],
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T01:00:00.000Z"
}
```

### Get recording segments

```
GET /recordings/:id/segments
```

Query parameters:
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 10)

Response:
```json
{
  "segments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "recordingId": "550e8400-e29b-41d4-a716-446655440000",
      "startTime": "2023-01-01T00:00:00.000Z",
      "endTime": "2023-01-01T00:10:00.000Z",
      "duration": 600,
      "filePath": "/recordings/550e8400/segment_1.mp4",
      "fileSize": 15000000,
      "format": "mp4",
      "resolution": "1920x1080",
      "thumbnailPath": "/thumbnails/segment_550e8400_1.jpg",
      "createdAt": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "recordingId": "550e8400-e29b-41d4-a716-446655440000",
      "startTime": "2023-01-01T00:10:00.000Z",
      "endTime": "2023-01-01T00:20:00.000Z",
      "duration": 600,
      "filePath": "/recordings/550e8400/segment_2.mp4",
      "fileSize": 15000000,
      "format": "mp4",
      "resolution": "1920x1080",
      "thumbnailPath": "/thumbnails/segment_550e8400_2.jpg",
      "createdAt": "2023-01-01T00:10:00.000Z"
    }
  ],
  "total": 6,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

### Start a new recording

```
POST /cameras/:id/recordings/start
```

Request body:
```json
{
  "settings": {
    "segmentDuration": 600,
    "format": "mp4",
    "resolution": "1920x1080"
  }
}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "startTime": "2023-01-01T00:00:00.000Z",
  "status": "recording",
  "message": "Recording started successfully"
}
```

### Stop a recording

```
POST /recordings/:id/stop
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "startTime": "2023-01-01T00:00:00.000Z",
  "endTime": "2023-01-01T01:00:00.000Z",
  "duration": 3600,
  "status": "completed",
  "message": "Recording stopped successfully"
}
```

### Delete a recording

```
DELETE /recordings/:id
```

Response:
```json
{
  "message": "Recording deleted successfully"
}
```

## Event Management API

### Get all events

```
GET /events
```

Query parameters:
- `cameraId` (optional): Filter by camera ID
- `recordingId` (optional): Filter by recording ID
- `type` (optional): Filter by event type (motion, person, vehicle, animal, custom)
- `startTime` (optional): Filter by start time (ISO date string)
- `endTime` (optional): Filter by end time (ISO date string)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 10)

Response:
```json
{
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "recordingId": "550e8400-e29b-41d4-a716-446655440000",
      "cameraId": "550e8400-e29b-41d4-a716-446655440000",
      "cameraName": "Front Door Camera",
      "timestamp": "2023-01-01T00:05:30.000Z",
      "type": "motion",
      "confidence": 0.85,
      "thumbnailPath": "/thumbnails/event_550e8400.jpg",
      "createdAt": "2023-01-01T00:05:30.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "recordingId": "550e8400-e29b-41d4-a716-446655440000",
      "cameraId": "550e8400-e29b-41d4-a716-446655440000",
      "cameraName": "Front Door Camera",
      "timestamp": "2023-01-01T00:15:45.000Z",
      "type": "person",
      "confidence": 0.92,
      "thumbnailPath": "/thumbnails/event_550e8401.jpg",
      "createdAt": "2023-01-01T00:15:45.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

### Get event by ID

```
GET /events/:id
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "recordingId": "550e8400-e29b-41d4-a716-446655440000",
  "recording": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "startTime": "2023-01-01T00:00:00.000Z",
    "endTime": "2023-01-01T01:00:00.000Z"
  },
  "camera": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Front Door Camera",
    "location": "Front Door"
  },
  "segmentId": "550e8400-e29b-41d4-a716-446655440001",
  "segment": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "startTime": "2023-01-01T00:10:00.000Z",
    "endTime": "2023-01-01T00:20:00.000Z",
    "filePath": "/recordings/550e8400/segment_2.mp4"
  },
  "timestamp": "2023-01-01T00:15:45.000Z",
  "type": "person",
  "confidence": 0.92,
  "thumbnailPath": "/thumbnails/event_550e8401.jpg",
  "detectedObjects": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "person",
      "confidence": 0.92,
      "boundingBox": {
        "x": 100,
        "y": 150,
        "width": 50,
        "height": 100
      }
    }
  ],
  "createdAt": "2023-01-01T00:15:45.000Z",
  "updatedAt": "2023-01-01T00:15:45.000Z"
}
```

### Get events by camera

```
GET /cameras/:id/events
```

Query parameters:
- `type` (optional): Filter by event type (motion, person, vehicle, animal, custom)
- `startTime` (optional): Filter by start time (ISO date string)
- `endTime` (optional): Filter by end time (ISO date string)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 10)

Response: Same as GET /events but filtered by camera ID

### Get events by recording

```
GET /recordings/:id/events
```

Query parameters:
- `type` (optional): Filter by event type (motion, person, vehicle, animal, custom)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 10)

Response: Same as GET /events but filtered by recording ID

## Object Detection API

### Get detection settings

```
GET /detection/settings
```

Response:
```json
{
  "enabled": true,
  "detectionInterval": 1000,
  "minConfidence": 0.6,
  "regions": [
    {
      "name": "Full Frame",
      "coordinates": [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ],
      "enabled": true
    }
  ],
  "objectTypes": [
    {
      "type": "person",
      "enabled": true,
      "minConfidence": 0.7
    },
    {
      "type": "vehicle",
      "enabled": true,
      "minConfidence": 0.7
    },
    {
      "type": "animal",
      "enabled": false,
      "minConfidence": 0.7
    }
  ],
  "motionDetection": {
    "enabled": true,
    "sensitivity": 0.5,
    "minArea": 500
  }
}
```

### Update detection settings

```
PUT /detection/settings
```

Request body:
```json
{
  "enabled": true,
  "detectionInterval": 500,
  "minConfidence": 0.7,
  "regions": [
    {
      "name": "Entrance Area",
      "coordinates": [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.8]
      ],
      "enabled": true
    }
  ],
  "objectTypes": [
    {
      "type": "person",
      "enabled": true,
      "minConfidence": 0.8
    },
    {
      "type": "vehicle",
      "enabled": true,
      "minConfidence": 0.8
    }
  ],
  "motionDetection": {
    "enabled": true,
    "sensitivity": 0.7,
    "minArea": 300
  }
}
```

Response:
```json
{
  "message": "Detection settings updated successfully",
  "settings": {
    // Updated settings object
  }
}
```

### Get camera detection settings

```
GET /cameras/:id/detection
```

Response:
```json
{
  "cameraId": "550e8400-e29b-41d4-a716-446655440000",
  "enabled": true,
  "detectionInterval": 1000,
  "minConfidence": 0.6,
  "regions": [
    {
      "name": "Driveway",
      "coordinates": [
        [0.1, 0.4],
        [0.9, 0.4],
        [0.9, 0.9],
        [0.1, 0.9]
      ],
      "enabled": true
    }
  ],
  "objectTypes": [
    {
      "type": "person",
      "enabled": true,
      "minConfidence": 0.7
    },
    {
      "type": "vehicle",
      "enabled": true,
      "minConfidence": 0.7
    }
  ],
  "motionDetection": {
    "enabled": true,
    "sensitivity": 0.6,
    "minArea": 400
  }
}
```

### Update camera detection settings

```
PUT /cameras/:id/detection
```

Request body:
```json
{
  "enabled": true,
  "detectionInterval": 500,
  "regions": [
    {
      "name": "Driveway",
      "coordinates": [
        [0.1, 0.4],
        [0.9, 0.4],
        [0.9, 0.9],
        [0.1, 0.9]
      ],
      "enabled": true
    },
    {
      "name": "Porch",
      "coordinates": [
        [0.4, 0.1],
        [0.6, 0.1],
        [0.6, 0.3],
        [0.4, 0.3]
      ],
      "enabled": true
    }
  ],
  "objectTypes": [
    {
      "type": "person",
      "enabled": true,
      "minConfidence": 0.8
    }
  ]
}
```

Response:
```json
{
  "message": "Camera detection settings updated successfully",
  "settings": {
    // Updated settings object
  }
}
```

## System API

### Get system status

```
GET /system/status
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "services": [
    {
      "name": "stream-ingestion",
      "status": "healthy",
      "uptime": 86400
    },
    {
      "name": "recording",
      "status": "healthy",
      "uptime": 86400
    },
    {
      "name": "object-detection",
      "status": "healthy",
      "uptime": 86400
    },
    {
      "name": "metadata-events",
      "status": "healthy",
      "uptime": 86400
    },
    {
      "name": "api-gateway",
      "status": "healthy",
      "uptime": 86400
    }
  ],
  "storage": {
    "total": 1000000000000,
    "used": 500000000000,
    "free": 500000000000,
    "recordings": {
      "total": 400000000000,
      "oldest": "2023-01-01T00:00:00.000Z"
    }
  },
  "cameras": {
    "total": 4,
    "online": 3,
    "offline": 1,
    "error": 0
  },
  "recordings": {
    "active": 3,
    "total": 100
  },
  "events": {
    "last24Hours": 50,
    "byType": {
      "motion": 30,
      "person": 15,
      "vehicle": 5
    }
  }
}
```

### Get system settings

```
GET /system/settings
```

Response:
```json
{
  "storage": {
    "recordingsPath": "/opt/omnisight/recordings",
    "maxUsage": 90,
    "retentionDays": 30,
    "autoCleanup": true
  },
  "notifications": {
    "email": {
      "enabled": true,
      "recipients": ["admin@example.com"]
    },
    "push": {
      "enabled": false
    }
  },
  "detection": {
    "enabled": true,
    "defaultSettings": {
      "detectionInterval": 1000,
      "minConfidence": 0.6
    }
  },
  "recording": {
    "enabled": true,
    "defaultSegmentDuration": 600,
    "defaultFormat": "mp4"
  }
}
```

### Update system settings

```
PUT /system/settings
```

Request body:
```json
{
  "storage": {
    "maxUsage": 80,
    "retentionDays": 14,
    "autoCleanup": true
  },
  "notifications": {
    "email": {
      "enabled": true,
      "recipients": ["admin@example.com", "user@example.com"]
    }
  }
}
```

Response:
```json
{
  "message": "System settings updated successfully",
  "settings": {
    // Updated settings object
  }
}
```

## WebSocket API

The WebSocket API provides real-time updates for events, camera status changes, and system notifications.

### Connection

Connect to the WebSocket server at:

```
ws://localhost:8000/api/v1/ws
```

Authentication is required via a token in the query string:

```
ws://localhost:8000/api/v1/ws?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Message Types

#### Camera Status Update

```json
{
  "type": "camera_status",
  "data": {
    "cameraId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "online",
    "timestamp": "2023-01-01T00:00:00.000Z"
  }
}
```

#### New Event

```json
{
  "type": "event",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "cameraId": "550e8400-e29b-41d4-a716-446655440000",
    "cameraName": "Front Door Camera",
    "recordingId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2023-01-01T00:00:00.000Z",
    "type": "person",
    "confidence": 0.92,
    "thumbnailPath": "/thumbnails/event_550e8400.jpg"
  }
}
```

#### Recording Status Update

```json
{
  "type": "recording_status",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "cameraId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "startTime": "2023-01-01T00:00:00.000Z",
    "endTime": "2023-01-01T01:00:00.000Z",
    "timestamp": "2023-01-01T01:00:00.000Z"
  }
}
```

#### System Notification

```json
{
  "type": "system_notification",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "level": "warning",
    "message": "Storage usage above 80%",
    "timestamp": "2023-01-01T00:00:00.000Z"
  }
}
```

### Client Commands

Clients can send commands to the server:

#### Subscribe to Camera Events

```json
{
  "type": "subscribe",
  "channel": "camera_events",
  "data": {
    "cameraId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Unsubscribe from Camera Events

```json
{
  "type": "unsubscribe",
  "channel": "camera_events",
  "data": {
    "cameraId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Heartbeat

```json
{
  "type": "heartbeat"
}
```

Server response:

```json
{
  "type": "heartbeat_ack",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

## Media API

### Get video segment

```
GET /media/segments/:id
```

Response: Video file stream

### Get event thumbnail

```
GET /media/thumbnails/events/:id
```

Response: Image file

### Get segment thumbnail

```
GET /media/thumbnails/segments/:id
```

Response: Image file

### Get camera snapshot

```
GET /cameras/:id/snapshot
```

Response: Image file

### Get live stream (HLS)

```
GET /cameras/:id/live/hls/index.m3u8
```

Response: HLS manifest file

### Get live stream (WebRTC)

```
GET /cameras/:id/live/webrtc
```

Response:
```json
{
  "sdpOffer": "v=0\no=- 0 0 IN IP4 127.0.0.1\ns=-\nt=0 0\na=group:BUNDLE audio video\n..."
}
```

## Error Responses

All API endpoints return standard error responses in the following format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {
      "resourceType": "Camera",
      "resourceId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

Common error codes:

- `UNAUTHORIZED`: Authentication required or invalid credentials
- `FORBIDDEN`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: The requested resource was not found
- `VALIDATION_ERROR`: Invalid request parameters
- `INTERNAL_SERVER_ERROR`: Server encountered an error
- `SERVICE_UNAVAILABLE`: Service is temporarily unavailable