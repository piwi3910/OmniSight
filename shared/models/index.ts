/**
 * Shared model interfaces to ensure consistency across services
 * These represent the core domain objects in the OmniSight system
 */
// Settings and metadata type definitions
export interface UserSettings {
  theme?: string;
  language?: string;
  notifications?: boolean;
  dashboardLayout?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CameraSettings {
  resolution?: string;
  fps?: number;
  bitrate?: number;
  nightMode?: boolean;
  motionDetection?: boolean;
  [key: string]: unknown;
}

export interface Metadata {
  [key: string]: unknown;
}

// User role enum
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER',
}

// Camera status enum
export enum CameraStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
}

// Stream status enum
export enum StreamStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
}

// Recording status enum
export enum RecordingStatus {
  RECORDING = 'RECORDING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

// User interface
export interface User {
  id: string;
  username: string;
  email: string;
  password: string; // Hashed
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  settings?: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

// Camera interface
export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  status: CameraStatus;
  ipAddress?: string;
  model?: string;
  location?: string;
  settings?: CameraSettings;
  createdAt: Date;
  updatedAt: Date;
}

// Stream interface
export interface Stream {
  id: string;
  cameraId: string;
  status: StreamStatus;
  startedAt?: Date;
  endedAt?: Date;
  metadata?: Metadata;
  createdAt: Date;
  updatedAt: Date;
}

// Recording interface
export interface Recording {
  id: string;
  cameraId: string;
  streamId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // In seconds
  status: RecordingStatus;
  metadata?: Metadata;
  createdAt: Date;
  updatedAt: Date;
}

// Segment interface (part of a recording)
export interface Segment {
  id: string;
  recordingId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // In seconds
  filePath: string;
  fileSize: number; // In bytes
  thumbnailPath?: string;
  metadata?: Metadata;
  createdAt: Date;
  updatedAt: Date;
}

// Event interface
export interface Event {
  id: string;
  recordingId?: string;
  cameraId?: string;
  timestamp: Date;
  eventType: string; // 'motion', 'object_detected', etc.
  confidence?: number;
  thumbnailPath?: string;
  metadata?: Metadata;
  createdAt: Date;
  updatedAt: Date;
}

// Object detection interface
export interface DetectedObject {
  id: string;
  eventId: string;
  objectType: string; // 'person', 'car', 'animal', etc.
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  metadata?: Metadata;
  createdAt: Date;
  updatedAt: Date;
}

// Notification interface
export interface Notification {
  id: string;
  userId?: string;
  eventId?: string;
  title: string;
  message: string;
  type: string; // 'email', 'push', 'in-app', etc.
  status: string; // 'pending', 'sent', 'read', 'failed'
  sentAt?: Date;
  readAt?: Date;
  metadata?: Metadata;
  createdAt: Date;
  updatedAt: Date;
}

// Retention policy interface
export interface RetentionPolicy {
  id: string;
  name: string;
  description?: string;
  cameraId?: string; // If null, applies to all cameras
  retentionDays: number;
  priority: number; // Higher priority policies override lower ones
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// System settings interface
export interface SystemSettings {
  id: string;
  settingKey: string;
  settingValue: string;
  category: string;
  description?: string;
  updatedBy?: string; // User ID who last updated
  updatedAt: Date;
}

// Generic metadata object type
export type MetadataObject = Metadata;
