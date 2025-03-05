/**
 * Factory functions for creating mock data for tests
 */

import { randomUUID } from 'crypto';

/**
 * Generate a mock event
 */
export function createMockEvent(overrides = {}) {
  const now = new Date();
  
  return {
    id: randomUUID(),
    type: 'OBJECT_DETECTED',
    timestamp: now,
    cameraId: randomUUID(),
    recordingId: randomUUID(),
    segmentId: randomUUID(),
    metadata: {
      confidence: 0.85,
      frameNumber: 120,
      timestamp: now.toISOString(),
    },
    ...overrides
  };
}

/**
 * Generate a mock camera
 */
export function createMockCamera(overrides = {}) {
  return {
    id: randomUUID(),
    name: 'Test Camera',
    url: 'rtsp://example.com/stream',
    status: 'ONLINE',
    type: 'RTSP',
    location: 'Test Location',
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: randomUUID(),
    ...overrides
  };
}

/**
 * Generate a mock recording
 */
export function createMockRecording(overrides = {}) {
  const now = new Date();
  const startTime = new Date(now.getTime() - 3600000); // 1 hour ago
  
  return {
    id: randomUUID(),
    cameraId: randomUUID(),
    startTime,
    endTime: now,
    status: 'COMPLETED',
    fileLocation: `/recordings/${randomUUID()}`,
    fileSize: 1024 * 1024 * 50, // 50 MB
    duration: 3600, // 1 hour in seconds
    createdAt: startTime,
    updatedAt: now,
    ...overrides
  };
}

/**
 * Generate a mock segment
 */
export function createMockSegment(overrides = {}) {
  const now = new Date();
  const startTime = new Date(now.getTime() - 600000); // 10 minutes ago
  
  return {
    id: randomUUID(),
    recordingId: randomUUID(),
    cameraId: randomUUID(),
    startTime,
    endTime: now,
    fileLocation: `/segments/${randomUUID()}.mp4`,
    fileSize: 1024 * 1024 * 5, // 5 MB
    duration: 600, // 10 minutes in seconds
    thumbnailLocation: `/thumbnails/${randomUUID()}.jpg`,
    sequence: 1,
    createdAt: startTime,
    updatedAt: now,
    ...overrides
  };
}

/**
 * Generate a mock detected object
 */
export function createMockDetectedObject(overrides = {}) {
  return {
    id: randomUUID(),
    eventId: randomUUID(),
    type: 'PERSON',
    confidence: 0.92,
    boundingBox: {
      x: 120,
      y: 80,
      width: 100,
      height: 200
    },
    createdAt: new Date(),
    ...overrides
  };
}

/**
 * Generate a mock user
 */
export function createMockUser(overrides = {}) {
  return {
    id: randomUUID(),
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed_password',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Generate a mock JWT token
 */
export function createMockToken(userId = randomUUID(), role = 'USER') {
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIke3VzZXJJZH0iLCJyb2xlIjoiJHtyb2xlfSIsImlhdCI6MTYxNjc2MjcwMCwiZXhwIjoxNjE2NzY2MzAwfQ.signature`;
}

/**
 * Generate multiple mock events
 */
export function createMockEvents(count = 10, baseOverrides = {}) {
  return Array.from({ length: count }, (_, i) => 
    createMockEvent({ 
      ...baseOverrides,
      id: randomUUID(),
      timestamp: new Date(Date.now() - i * 60000) // Each event 1 minute apart
    })
  );
}

/**
 * Generate multiple mock cameras
 */
export function createMockCameras(count = 5, baseOverrides = {}) {
  return Array.from({ length: count }, (_, i) => 
    createMockCamera({ 
      ...baseOverrides,
      id: randomUUID(),
      name: `Test Camera ${i + 1}`
    })
  );
}