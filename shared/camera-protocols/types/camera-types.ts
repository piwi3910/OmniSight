/**
 * Camera protocol types and interfaces
 */

/**
 * Camera capabilities
 */
export enum CameraCapability {
  PTZ = 'ptz',
  PRESETS = 'presets',
  DIGITAL_PTZ = 'digital_ptz',
  MOTION_DETECTION = 'motion_detection',
  AUDIO = 'audio',
  TWO_WAY_AUDIO = 'two_way_audio',
  EVENTS = 'events',
  IO_PORTS = 'io_ports',
  PRIVACY_MASK = 'privacy_mask',
  CONFIGURATION = 'configuration',
  WDR = 'wdr'
}

/**
 * Camera capabilities as a structured object
 */
export interface CameraCapabilities {
  ptz: boolean;
  presets: boolean;
  digitalPtz: boolean;
  motionDetection: boolean;
  audio: boolean;
  twoWayAudio: boolean;
  events: boolean;
  ioPorts: boolean;
  privacyMask: boolean;
  configuration: boolean;
  wdr: boolean;
}

/**
 * Camera connection status
 */
export interface ConnectionStatus {
  connected: boolean;
  error: string | null;
}

/**
 * Stream settings
 */
export interface StreamSettings {
  id: string;
  name: string;
  url: string;
  type: 'rtsp' | 'http' | 'websocket' | 'webrtc' | 'hls' | 'mjpeg';
  resolution: {
    width: number;
    height: number;
  };
  format: string;
  rtspUrl?: string;
  httpUrl?: string;
  webrtcUrl?: string;
  hlsUrl?: string;
  mjpegUrl?: string;
}

/**
 * PTZ command
 */
export interface PTZCommand {
  action: 'move' | 'stop' | 'preset' | 'home' | 'zoom' | 'focus';
  params?: {
    pan?: number;
    tilt?: number;
    zoom?: number;
    focus?: number;
    speed?: number;
    preset?: string | number;
  };
  channel?: string;
}

/**
 * Camera event
 */
export interface CameraEvent {
  id: string;
  type: string;
  timestamp: Date;
  source: string;
  data: any;
}

/**
 * Camera preset
 */
export interface CameraPreset {
  id: string;
  name: string;
  position?: {
    pan: number;
    tilt: number;
    zoom: number;
  };
}

/**
 * Video frame
 */
export interface VideoFrame {
  data: Buffer;
  timestamp: number;
  width: number;
  height: number;
  format: string;
}

/**
 * Camera information
 */
export interface CameraInfo {
  id: string;
  name: string;
  model?: string;
  manufacturer?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  host: string;         // Hostname or IP address
  port?: number;        // Network port
  macAddress?: string;
  serialNumber?: string;
  username?: string;    // For authentication
  password?: string;    // For authentication
}