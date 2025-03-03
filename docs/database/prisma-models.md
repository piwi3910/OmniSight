# OmniSight Database Schema (Prisma)

This document outlines the database schema used in OmniSight, implemented using Prisma as the ORM.

## Overview

OmniSight uses PostgreSQL as the primary database system. The schema is defined using Prisma schema language. The database is shared between services, but primarily managed by the Metadata & Events service.

## Entity Relationships

![Entity Relationship Diagram](../assets/entity-relationship-diagram.png)

The following diagram shows the main relationships between entities:

```
User 1--* Notification
Camera 1--* Stream
Camera 1--* Recording
Recording 1--* Segment
Recording 1--* Event
Event 1--* DetectedObject
```

## Schema Definition

```prisma
// This is the Prisma schema file

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// User model
model User {
  id        String      @id @default(uuid())
  username  String      @unique
  email     String      @unique
  password  String
  role      UserRole    @default(USER)
  isActive  Boolean     @default(true)
  lastLogin DateTime?
  settings  Json?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  notifications Notification[]
}

// Camera model
model Camera {
  id        String        @id @default(uuid())
  name      String
  rtspUrl   String
  username  String?
  password  String?
  status    CameraStatus  @default(OFFLINE)
  ipAddress String?
  model     String?
  location  String?
  settings  Json?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  streams    Stream[]
  recordings Recording[]
}

// Stream model
model Stream {
  id        String       @id @default(uuid())
  cameraId  String
  status    StreamStatus @default(INACTIVE)
  startedAt DateTime?
  endedAt   DateTime?
  metadata  Json?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  camera Camera @relation(fields: [cameraId], references: [id])
}

// Recording model
model Recording {
  id        String           @id @default(uuid())
  cameraId  String
  streamId  String?
  startTime DateTime
  endTime   DateTime?
  duration  Int?             // In seconds
  status    RecordingStatus  @default(RECORDING)
  metadata  Json?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  camera   Camera    @relation(fields: [cameraId], references: [id])
  segments Segment[]
  events   Event[]
}

// Segment model
model Segment {
  id            String   @id @default(uuid())
  recordingId   String
  startTime     DateTime
  endTime       DateTime
  duration      Int      // In seconds
  filePath      String
  fileSize      Int      // In bytes
  thumbnailPath String?
  metadata      Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  recording Recording @relation(fields: [recordingId], references: [id])
}

// Event model
model Event {
  id            String   @id @default(uuid())
  recordingId   String?
  cameraId      String?
  timestamp     DateTime
  eventType     String
  confidence    Float?
  thumbnailPath String?
  metadata      Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  recording       Recording?       @relation(fields: [recordingId], references: [id])
  detectedObjects DetectedObject[]
}

// DetectedObject model
model DetectedObject {
  id         String   @id @default(uuid())
  eventId    String
  objectType String
  confidence Float
  boundingBox Json    // { x, y, width, height }
  metadata   Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  event Event @relation(fields: [eventId], references: [id])
}

// Notification model
model Notification {
  id        String    @id @default(uuid())
  userId    String?
  eventId   String?
  title     String
  message   String
  type      String
  status    String
  sentAt    DateTime?
  readAt    DateTime?
  metadata  Json?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  user User? @relation(fields: [userId], references: [id])
}

// RetentionPolicy model
model RetentionPolicy {
  id            String   @id @default(uuid())
  name          String
  description   String?
  cameraId      String?
  retentionDays Int
  priority      Int
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// SystemSettings model
model SystemSettings {
  id          String   @id @default(uuid())
  settingKey  String   @unique
  settingValue String
  category    String
  description String?
  updatedBy   String?
  updatedAt   DateTime @updatedAt
}

// Enum definitions
enum UserRole {
  ADMIN
  USER
  VIEWER
}

enum CameraStatus {
  ONLINE
  OFFLINE
  ERROR
}

enum StreamStatus {
  ACTIVE
  INACTIVE
  ERROR
}

enum RecordingStatus {
  RECORDING
  COMPLETED
  ERROR
}
```

## Data Flow

1. **Cameras**: Each camera has a unique ID and RTSP URL for streaming
2. **Streams**: When a stream is started for a camera, a Stream record is created
3. **Recordings**: When recording is enabled for a stream, a Recording record is created
4. **Segments**: As the recording progresses, it's split into manageable Segments
5. **Events**: When something of interest happens (motion, object detected), an Event is created
6. **DetectedObjects**: Objects identified in events are stored with bounding boxes

## Model Descriptions

### User

Represents a user of the system:
- **ADMIN**: Full access to all features
- **USER**: Standard user with restricted access to settings
- **VIEWER**: View-only access to cameras and recordings

### Camera

Represents a connected camera:
- Stores connection details (RTSP URL, credentials)
- Tracks connection status
- Contains metadata about the camera (location, model)

### Stream

Represents an active video stream:
- Created when streaming is initiated from a camera
- Tracked to determine if a camera is currently streaming
- Provides start/end times for streams

### Recording

Represents a continuous recording session:
- Links to the camera and optionally to a stream
- Contains timing information
- Divided into multiple segments

### Segment

Represents a portion of a recording:
- Has a specific file path to the video segment
- Contains start/end times and duration
- Includes file size for storage management

### Event

Represents something of interest that occurred:
- Can be motion detection, object detection, etc.
- Has a timestamp for when it occurred
- Contains a confidence level
- May have a thumbnail image

### DetectedObject

Represents an object detected in an event:
- Links to the event where it was detected
- Contains bounding box coordinates
- Includes object type (person, car, etc.)
- Has a confidence level

### Notification

Represents a notification sent to a user:
- Can be linked to an event or user
- Contains message details
- Tracks status (sent, read, etc.)

### RetentionPolicy

Defines how long recordings are kept:
- Can apply to all cameras or specific ones
- Sets retention period in days
- Has a priority for resolving conflicts

### SystemSettings

Stores global system settings:
- Key-value pairs organized by category
- Accessible by all services