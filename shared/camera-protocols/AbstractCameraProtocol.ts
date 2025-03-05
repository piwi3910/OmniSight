import { 
  CameraCapabilities, 
  CameraCapability, 
  ConnectionStatus, 
  StreamSettings, 
  PTZCommand, 
  CameraEvent,
  CameraPreset,
  VideoFrame,
  CameraInfo
} from './types/camera-types';

/**
 * Logger interface
 */
export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Abstract base class for all camera protocols
 */
export abstract class AbstractCameraProtocol {
  protected metadata: CameraInfo;
  protected capabilities: CameraCapabilities = {
    ptz: false,
    presets: false,
    digitalPtz: false,
    motionDetection: false,
    audio: false,
    twoWayAudio: false,
    events: false,
    ioPorts: false,
    privacyMask: false,
    configuration: false,
    wdr: false
  };
  
  // Protocol identification
  abstract get protocolId(): string;
  abstract get protocolName(): string;

  constructor(cameraInfo: CameraInfo) {
    this.metadata = cameraInfo;
  }

  /**
   * Connect to the camera
   */
  abstract connect(): Promise<ConnectionStatus>;

  /**
   * Disconnect from the camera
   */
  abstract disconnect(): Promise<void>;

  /**
   * Get a single video frame from the camera
   */
  abstract getFrame(streamId?: string): Promise<VideoFrame | null>;

  /**
   * Get camera information
   */
  getCameraInfo(): CameraInfo {
    return this.metadata;
  }

  /**
   * Update camera information
   */
  updateCameraInfo(info: Partial<CameraInfo>): void {
    this.metadata = { ...this.metadata, ...info };
  }

  /**
   * Get available streams from the camera
   */
  abstract getAvailableStreams(): Promise<StreamSettings[]>;

  /**
   * Get camera capabilities
   */
  getCapabilities(): CameraCapability[] {
    const result: CameraCapability[] = [];
    
    Object.entries(this.capabilities).forEach(([key, enabled]) => {
      if (enabled) {
        result.push(key as CameraCapability);
      }
    });
    
    return result;
  }

  /**
   * Check if camera has a specific capability
   */
  hasCapability(capability: CameraCapability): boolean {
    const capKey = capability.toString();
    return Object.entries(this.capabilities).some(([key, value]) => 
      key === capKey && value === true
    );
  }

  /**
   * Execute a PTZ command
   */
  abstract executePTZCommand(command: PTZCommand): Promise<boolean>;

  /**
   * Get available camera presets
   */
  abstract getPresets(): Promise<CameraPreset[]>;

  /**
   * Create a new camera preset
   */
  abstract createPreset(name: string, position?: any): Promise<CameraPreset | null>;

  /**
   * Delete a camera preset
   */
  abstract deletePreset(presetId: string): Promise<boolean>;

  /**
   * Get a snapshot image from the camera
   */
  abstract getSnapshot(streamId?: string): Promise<Buffer | null>;

  /**
   * Subscribe to camera events
   */
  abstract subscribeToEvents(eventTypes: string[]): Promise<string>;

  /**
   * Unsubscribe from camera events
   */
  abstract unsubscribeFromEvents(subscriptionId: string): Promise<boolean>;

  /**
   * Start recording on the camera (if supported)
   */
  abstract startRecording(options?: any): Promise<boolean>;

  /**
   * Stop recording on the camera (if supported)
   */
  abstract stopRecording(): Promise<boolean>;

  /**
   * Reboot the camera
   */
  abstract reboot(): Promise<boolean>;

  /**
   * Update camera settings
   */
  abstract updateSettings(settings: any): Promise<boolean>;
}