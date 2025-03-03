/**
 * ICameraProtocol - Core interface for all camera protocol implementations
 * 
 * This interface defines the standard contract that all camera protocol
 * implementations must follow, providing a unified way to interact with
 * cameras regardless of the underlying protocol (RTSP, MJPEG, ONVIF, etc.)
 */
export interface ICameraProtocol {
  /**
   * Unique identifier for this protocol
   */
  readonly protocolId: string;
  
  /**
   * Human-readable name of the protocol
   */
  readonly protocolName: string;
  
  /**
   * Protocol specific capabilities
   */
  readonly capabilities: CameraCapabilities;
  
  /**
   * Connect to the camera using this protocol
   * 
   * @param config - Configuration for connecting to the camera
   * @returns Promise resolving to true if connection succeeded
   */
  connect(config: CameraConfig): Promise<boolean>;
  
  /**
   * Disconnect from the camera
   * 
   * @returns Promise resolving when disconnection is complete
   */
  disconnect(): Promise<void>;
  
  /**
   * Get the current connection status
   * 
   * @returns Current connection status
   */
  getConnectionStatus(): ConnectionStatus;
  
  /**
   * Start streaming from the camera
   * 
   * @param options - Streaming options
   * @returns Promise resolving to a stream identifier
   */
  startStream(options?: StreamOptions): Promise<string>;
  
  /**
   * Stop streaming from the camera
   * 
   * @param streamId - Stream identifier to stop (if multiple streams supported)
   * @returns Promise resolving when streaming is stopped
   */
  stopStream(streamId?: string): Promise<void>;
  
  /**
   * Get a frame from the camera
   * 
   * @returns Promise resolving to a Uint8Array containing the frame data
   */
  getFrame(): Promise<Uint8Array>;
  
  /**
   * Move the camera (if PTZ capabilities exist)
   * 
   * @param movement - Movement parameters
   * @returns Promise resolving when movement is complete
   * @throws Error if camera doesn't support PTZ
   */
  move(movement: PtzMovement): Promise<void>;
  
  /**
   * Go to a preset position (if PTZ capabilities exist)
   * 
   * @param presetId - Identifier for the preset
   * @returns Promise resolving when movement to preset is complete
   * @throws Error if camera doesn't support presets
   */
  gotoPreset(presetId: string): Promise<void>;
  
  /**
   * Save current position as a preset (if PTZ capabilities exist)
   * 
   * @param presetName - Name for the preset
   * @returns Promise resolving to the preset ID
   * @throws Error if camera doesn't support presets
   */
  savePreset(presetName: string): Promise<string>;
  
  /**
   * Get camera information
   * 
   * @returns Promise resolving to camera information
   */
  getCameraInfo(): Promise<CameraInfo>;
  
  /**
   * Get list of available streams/profiles
   * 
   * @returns Promise resolving to array of available stream profiles
   */
  getAvailableStreams(): Promise<StreamProfile[]>;
  
  /**
   * Get protocol-specific configuration options
   * 
   * @returns Configuration options specific to this protocol
   */
  getProtocolOptions(): Record<string, any>;
  
  /**
   * Set protocol-specific configuration options
   * 
   * @param options - Protocol-specific options
   * @returns Promise resolving when options are set
   */
  setProtocolOptions(options: Record<string, any>): Promise<void>;
  
  /**
   * Test if a camera is accessible via this protocol
   * 
   * @param config - Camera configuration to test
   * @returns Promise resolving to true if camera is accessible
   */
  testConnection(config: CameraConfig): Promise<boolean>;
  
  /**
   * Get events from the camera (if supported)
   * 
   * @param eventTypes - Types of events to subscribe to
   * @returns Promise resolving to an event subscription ID
   */
  subscribeToEvents(eventTypes: string[]): Promise<string>;
  
  /**
   * Unsubscribe from camera events
   * 
   * @param subscriptionId - Event subscription ID
   * @returns Promise resolving when unsubscription is complete
   */
  unsubscribeFromEvents(subscriptionId: string): Promise<void>;
  
  /**
   * Register an event handler for camera events
   * 
   * @param handler - Event handler function
   * @returns Handler ID for later removal
   */
  onEvent(handler: (event: CameraEvent) => void): string;
  
  /**
   * Remove an event handler
   * 
   * @param handlerId - Handler ID to remove
   */
  removeEventHandler(handlerId: string): void;
}

/**
 * Camera configuration options
 */
export interface CameraConfig {
  /**
   * Camera IP address or hostname
   */
  host: string;
  
  /**
   * Port for camera connection
   */
  port: number;
  
  /**
   * Path for stream (e.g., /cam/realmonitor)
   */
  path?: string;
  
  /**
   * Username for authentication
   */
  username?: string;
  
  /**
   * Password for authentication
   */
  password?: string;
  
  /**
   * Connection timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Protocol-specific options
   */
  options?: Record<string, any>;
}

/**
 * Camera streaming options
 */
export interface StreamOptions {
  /**
   * Desired stream profile/channel
   */
  profile?: string;
  
  /**
   * Desired resolution (width x height)
   */
  resolution?: { width: number; height: number };
  
  /**
   * Desired frame rate
   */
  frameRate?: number;
  
  /**
   * Encoding format (h264, h265, mjpeg, etc.)
   */
  encoding?: string;
  
  /**
   * Streaming protocol specific parameters
   */
  parameters?: Record<string, any>;
}

/**
 * Camera connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

/**
 * PTZ movement parameters
 */
export interface PtzMovement {
  /**
   * Pan movement (-1.0 to 1.0, 0 is no movement)
   */
  pan?: number;
  
  /**
   * Tilt movement (-1.0 to 1.0, 0 is no movement)
   */
  tilt?: number;
  
  /**
   * Zoom movement (-1.0 to 1.0, 0 is no movement)
   */
  zoom?: number;
  
  /**
   * Movement speed (0.0 to 1.0)
   */
  speed?: number;
  
  /**
   * Absolute position mode (true) or relative movement (false)
   */
  absolute?: boolean;
  
  /**
   * Continue moving until stopped (true) or move once (false)
   */
  continuous?: boolean;
}

/**
 * Camera capabilities
 */
export interface CameraCapabilities {
  /**
   * Supports Pan-Tilt-Zoom controls
   */
  ptz: boolean;
  
  /**
   * Supports PTZ presets
   */
  presets: boolean;
  
  /**
   * Supports digital PTZ (client-side zooming)
   */
  digitalPtz: boolean;
  
  /**
   * Supports camera-side motion detection
   */
  motionDetection: boolean;
  
  /**
   * Supports direct audio streaming
   */
  audio: boolean;
  
  /**
   * Supports two-way audio
   */
  twoWayAudio: boolean;
  
  /**
   * Available stream encodings
   */
  encodings: string[];
  
  /**
   * Available authentication methods
   */
  authMethods: string[];
  
  /**
   * Supports camera-side recording
   */
  localRecording: boolean;
  
  /**
   * Supports direct event subscription
   */
  events: boolean;
  
  /**
   * Maximum supported resolution
   */
  maxResolution?: { width: number; height: number };
  
  /**
   * Maximum supported frame rate
   */
  maxFrameRate?: number;
  
  /**
   * Protocol-specific capabilities
   */
  protocolSpecific?: Record<string, any>;
}

/**
 * Camera information
 */
export interface CameraInfo {
  /**
   * Camera manufacturer
   */
  manufacturer: string;
  
  /**
   * Camera model
   */
  model: string;
  
  /**
   * Camera firmware version
   */
  firmwareVersion: string;
  
  /**
   * Camera serial number
   */
  serialNumber?: string;
  
  /**
   * Camera hardware ID
   */
  hardwareId?: string;
  
  /**
   * Camera MAC address
   */
  macAddress?: string;
  
  /**
   * Camera additional information
   */
  additionalInfo?: Record<string, any>;
}

/**
 * Stream profile information
 */
export interface StreamProfile {
  /**
   * Profile identifier
   */
  id: string;
  
  /**
   * Profile name
   */
  name: string;
  
  /**
   * Stream encoding (h264, h265, mjpeg, etc.)
   */
  encoding: string;
  
  /**
   * Stream resolution
   */
  resolution: { width: number; height: number };
  
  /**
   * Stream frame rate
   */
  frameRate: number;
  
  /**
   * Stream bitrate (if applicable)
   */
  bitrate?: number;
  
  /**
   * Profile additional parameters
   */
  parameters?: Record<string, any>;
}

/**
 * Camera event information
 */
export interface CameraEvent {
  /**
   * Event type
   */
  type: string;
  
  /**
   * Event timestamp
   */
  timestamp: Date;
  
  /**
   * Event source (camera ID, component)
   */
  source: string;
  
  /**
   * Event data
   */
  data: Record<string, any>;
}