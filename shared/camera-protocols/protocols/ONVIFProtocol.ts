/**
 * ONVIF Protocol Implementation
 * 
 * Implements the ONVIF (Open Network Video Interface Forum) protocol for the OmniSight system.
 * ONVIF is a global standard for IP-based security products that provides a common interface
 * for devices from different manufacturers.
 */

import { AbstractCameraProtocol } from '../AbstractCameraProtocol';
import { 
  CameraCapabilities, 
  CameraConfig, 
  CameraEvent, 
  CameraInfo, 
  ConnectionStatus, 
  PtzMovement, 
  StreamOptions, 
  StreamProfile 
} from '../interfaces/ICameraProtocol';
// Import the onvif package (already in package.json)
// Use require instead of import to bypass TypeScript typechecking
const onvif = require('onvif');
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Define ONVIF device class since TypeScript definitions might be missing
interface OnvifDevice {
  init(callback: (err: Error | null, info?: any) => void): void;
  getDeviceInformation(callback: (err: Error | null, info: any) => void): void;
  services: {
    device?: any;
    media?: any;
    ptz?: any;
    events?: any;
    analytics?: any;
    imaging?: any;
  };
  deviceInformation?: any;
}

/**
 * ONVIF protocol events
 */
export enum ONVIFEvent {
  DEVICE_CONNECTED = 'onvif:device_connected',
  DEVICE_DISCONNECTED = 'onvif:device_disconnected',
  PTZ_MOVED = 'onvif:ptz_moved',
  PRESET_SAVED = 'onvif:preset_saved',
  PRESET_RECALLED = 'onvif:preset_recalled',
  STREAM_STARTED = 'onvif:stream_started',
  STREAM_STOPPED = 'onvif:stream_stopped',
  PROFILE_CHANGED = 'onvif:profile_changed',
  EVENT_RECEIVED = 'onvif:event_received',
  ERROR = 'onvif:error'
}

/**
 * ONVIF device information
 */
export interface ONVIFDeviceInfo {
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  hardwareId: string;
  scopes: string[];
  supportedServices: string[];
}

/**
 * ONVIF PTZ status
 */
export interface ONVIFPtzStatus {
  position: {
    x: number;
    y: number;
    zoom: number;
  };
  moveStatus: {
    panTilt: 'IDLE' | 'MOVING' | 'UNKNOWN';
    zoom: 'IDLE' | 'MOVING' | 'UNKNOWN';
  };
  error: string | null;
  utcDateTime: Date;
}

/**
 * ONVIF preset
 */
export interface ONVIFPreset {
  token: string;
  name: string;
  position?: {
    x: number;
    y: number;
    zoom: number;
  };
}

/**
 * ONVIF protocol statistics
 */
export interface ONVIFStats {
  connected: boolean;
  connectionTime?: Date;
  lastActivity?: Date;
  activeStreams: number;
  activeEvents: number;
  ptzMoveCount: number;
  presetCount: number;
  lastError?: string;
}

/**
 * ONVIF protocol implementation for the OmniSight system
 */
export class ONVIFProtocol extends AbstractCameraProtocol {
  // Protocol identifier
  readonly protocolId: string = 'onvif';
  
  // Protocol name
  readonly protocolName: string = 'ONVIF';
  
  // Camera capabilities - will be updated after connection
  readonly capabilities: CameraCapabilities = {
    ptz: false,
    presets: false,
    digitalPtz: false,
    motionDetection: false,
    audio: false,
    twoWayAudio: false,
    encodings: [],
    authMethods: ['digest', 'wsse'],
    localRecording: false,
    events: false,
    protocolSpecific: {}
  };
  
  // ONVIF device reference
  private device: OnvifDevice | null = null;
  
  // ONVIF services
  private services: {
    deviceService?: any;
    mediaService?: any;
    ptzService?: any;
    eventService?: any;
    analyticsService?: any;
    imagingService?: any;
  } = {};
  
  // ONVIF profiles
  private profiles: any[] = [];
  
  // ONVIF presets
  private presets: ONVIFPreset[] = [];
  
  // ONVIF event subscriptions (separate from AbstractCameraProtocol's eventSubscriptions)
  protected onvifEventSubscriptions: Map<string, any> = new Map();
  
  // Event emitter for internal events
  private eventEmitter = new EventEmitter();
  
  // Active streams
  private streamUrls: Map<string, { url: string, profile: any }> = new Map();
  
  // Statistics
  private stats: ONVIFStats = {
    connected: false,
    activeStreams: 0,
    activeEvents: 0,
    ptzMoveCount: 0,
    presetCount: 0
  };
  
  // Logger
  private logger = {
    debug: (message: string) => console.debug(`[ONVIF] ${message}`),
    info: (message: string) => console.info(`[ONVIF] ${message}`),
    warn: (message: string) => console.warn(`[ONVIF] ${message}`),
    error: (message: string) => console.error(`[ONVIF] ${message}`)
  };
  
  constructor() {
    super();
    
    // Set up event handlers for internal events
    this.setupEventHandlers();
  }
  
  /**
   * Connect to the camera
   * 
   * @param config Camera configuration
   * @returns Promise that resolves to true when connected
   */
  protected async performConnect(config: CameraConfig): Promise<boolean> {
    try {
      // Create ONVIF device
      // Create a new ONVIF device instance
      this.device = await new Promise<OnvifDevice>((resolve, reject) => {
        try {
          const Cam = onvif.Cam;
          
          if (!Cam) {
            reject(new Error('ONVIF Camera class not found in onvif package'));
            return;
          }
          
          // Using callback-style initialization that the onvif library expects
          new Cam({
            hostname: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            timeout: config.timeout || 10000
          }, (err: Error | null, cam: any) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Successfully created and connected to the camera
            resolve(cam as OnvifDevice);
          });
        } catch (error) {
          reject(error);
        }
      });
      
      // Get device information and capabilities
      await this.getDeviceInformation();
      
      // Get available services
      await this.getServices();
      
      // Get media profiles
      await this.getMediaProfiles();
      
      // Get PTZ capabilities and presets if available
      if (this.services.ptzService) {
        this.capabilities.ptz = true;
        this.capabilities.presets = true;
        await this.getPresets();
      }
      
      // Get event capabilities if available
      if (this.services.eventService) {
        this.capabilities.events = true;
      }
      
      // Update stats
      this.stats.connected = true;
      this.stats.connectionTime = new Date();
      this.stats.lastActivity = new Date();
      
      // Trigger device connected event
      this.eventEmitter.emit(ONVIFEvent.DEVICE_CONNECTED, {
        deviceInfo: await this.getCameraInfo(),
        capabilities: this.capabilities
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to ONVIF device: ${error instanceof Error ? error.message : String(error)}`);
      this.stats.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }
  
  /**
   * Disconnect from the camera
   */
  protected async performDisconnect(): Promise<void> {
    // Disconnect from any active event subscriptions
    for (const [subscriptionId, subscription] of this.onvifEventSubscriptions.entries()) {
      try {
        await this.performUnsubscribeFromEvents(subscriptionId);
      } catch (error) {
        this.logger.warn(`Error unsubscribing from events: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Update stats
    this.stats.connected = false;
    
    // Trigger device disconnected event
    this.eventEmitter.emit(ONVIFEvent.DEVICE_DISCONNECTED, {
      timestamp: new Date()
    });
    
    // Clear device and services
    this.device = null;
    this.services = {};
    this.profiles = [];
    this.presets = [];
    this.streamUrls.clear();
  }
  
  /**
   * Get a frame from the camera
   */
  async getFrame(): Promise<Uint8Array> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED || !this.device) {
      throw new Error('Cannot get frame: Camera is not connected');
    }
    
    try {
      // Get snapshot URI from the first profile
      if (!this.profiles.length) {
        throw new Error('No media profiles available');
      }
      
      const profile = this.profiles[0];
      const snapshotUri = await new Promise<string>((resolve, reject) => {
        this.services.mediaService.getSnapshotUri({
          ProfileToken: profile.token
        }, (err: Error | null, result: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result.Uri);
        });
      });
      
      // Get snapshot image using fetch
      const response = await fetch(snapshotUri, {
        headers: {
          'Authorization': this.createBasicAuthHeader()
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get snapshot: ${response.status} ${response.statusText}`);
      }
      
      // Convert response to buffer
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (error) {
      this.logger.error(`Failed to get frame: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Create a basic auth header
   */
  private createBasicAuthHeader(): string {
    if (!this.config?.username || !this.config?.password) {
      return '';
    }
    
    const auth = `${this.config.username}:${this.config.password}`;
    return `Basic ${Buffer.from(auth).toString('base64')}`;
  }
  
  /**
   * Get camera information
   */
  async getCameraInfo(): Promise<CameraInfo> {
    if (!this.device) {
      throw new Error('Camera is not connected');
    }
    
    // Get device information if not already cached
    if (!this.device.deviceInformation) {
      await this.getDeviceInformation();
    }
    
    return {
      manufacturer: this.device.deviceInformation.manufacturer || 'Unknown',
      model: this.device.deviceInformation.model || 'Unknown',
      firmwareVersion: this.device.deviceInformation.firmwareVersion || 'Unknown',
      serialNumber: this.device.deviceInformation.serialNumber || undefined,
      hardwareId: this.device.deviceInformation.hardwareId || undefined,
      additionalInfo: {
        protocol: 'ONVIF',
        supportedServices: Object.keys(this.services)
      }
    };
  }
  
  /**
   * Get available stream profiles
   */
  async getAvailableStreams(): Promise<StreamProfile[]> {
    if (!this.device || !this.services.mediaService) {
      throw new Error('Camera is not connected or media service is not available');
    }
    
    // Return cached profiles if available
    if (this.profiles.length > 0) {
      return this.profiles.map(profile => this.convertProfileToStreamProfile(profile));
    }
    
    // Otherwise, get profiles
    await this.getMediaProfiles();
    
    return this.profiles.map(profile => this.convertProfileToStreamProfile(profile));
  }
  
  /**
   * Convert ONVIF profile to stream profile
   */
  private convertProfileToStreamProfile(profile: any): StreamProfile {
    // Extract video encoder configuration
    const videoConfig = profile.videoEncoderConfiguration || {};
    
    return {
      id: profile.token,
      name: profile.name,
      encoding: videoConfig.encoding || 'H264',
      resolution: videoConfig.resolution ? {
        width: videoConfig.resolution.width || 640,
        height: videoConfig.resolution.height || 480
      } : { width: 640, height: 480 },
      frameRate: videoConfig.rateControl ? videoConfig.rateControl.frameRateLimit || 30 : 30,
      bitrate: videoConfig.rateControl ? videoConfig.rateControl.bitrateLimit || undefined : undefined,
      parameters: {
        quality: videoConfig.quality || 0,
        govLength: videoConfig.h264?.govLength || undefined,
        profile: videoConfig.h264?.h264Profile || undefined
      }
    };
  }
  
  /**
   * Get protocol-specific options
   */
  getProtocolOptions(): Record<string, any> {
    return {
      profiles: this.profiles.map(p => ({ token: p.token, name: p.name })),
      presets: this.presets,
      supportsPTZ: this.capabilities.ptz,
      supportsEvents: this.capabilities.events,
      stats: this.stats
    };
  }
  
  /**
   * Set protocol-specific options
   */
  async setProtocolOptions(options: Record<string, any>): Promise<void> {
    // No settable options for ONVIF protocol yet
  }
  
  /**
   * Start a stream
   */
  protected async performStartStream(options?: StreamOptions): Promise<string> {
    if (!this.device || !this.services.mediaService) {
      throw new Error('Camera is not connected or media service is not available');
    }
    
    try {
      // Find the appropriate profile
      let profile: any;
      if (options?.profile) {
        // Find profile by ID/token
        profile = this.profiles.find(p => p.token === options.profile);
        if (!profile) {
          throw new Error(`Profile not found: ${options.profile}`);
        }
      } else if (options?.resolution) {
        // Find profile by resolution
        profile = this.findProfileByResolution(options.resolution.width, options.resolution.height);
        if (!profile) {
          // Fall back to first profile
          profile = this.profiles[0];
        }
      } else {
        // Use first profile by default
        profile = this.profiles[0];
      }
      
      if (!profile) {
        throw new Error('No suitable profile found');
      }
      
      // Get stream URI
      const streamUri = await new Promise<string>((resolve, reject) => {
        this.services.mediaService.getStreamUri({
          ProfileToken: profile.token,
          Protocol: 'RTSP'
        }, (err: Error | null, result: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result.Uri);
        });
      });
      
      // Generate stream ID
      const streamId = `onvif-stream-${uuidv4()}`;
      
      // Store stream URL
      this.streamUrls.set(streamId, { url: streamUri, profile });
      
      // Update stats
      this.stats.activeStreams++;
      this.stats.lastActivity = new Date();
      
      // Trigger stream started event
      this.eventEmitter.emit(ONVIFEvent.STREAM_STARTED, {
        streamId,
        profileToken: profile.token,
        streamUri
      });
      
      return streamId;
    } catch (error) {
      this.logger.error(`Failed to start stream: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Find profile by resolution
   */
  private findProfileByResolution(width: number, height: number): any {
    // Try to find exact match
    const profile = this.profiles.find(p => {
      const resolution = p.videoEncoderConfiguration?.resolution;
      return resolution && resolution.width === width && resolution.height === height;
    });
    
    if (profile) {
      return profile;
    }
    
    // Try to find closest match
    const sortedProfiles = [...this.profiles].sort((a, b) => {
      const resA = a.videoEncoderConfiguration?.resolution;
      const resB = b.videoEncoderConfiguration?.resolution;
      
      if (!resA) return 1;
      if (!resB) return -1;
      
      const diffA = Math.abs(resA.width - width) + Math.abs(resA.height - height);
      const diffB = Math.abs(resB.width - width) + Math.abs(resB.height - height);
      
      return diffA - diffB;
    });
    
    return sortedProfiles[0];
  }
  
  /**
   * Stop a stream
   */
  protected async performStopStream(streamId: string): Promise<void> {
    // Check if stream exists
    if (!this.streamUrls.has(streamId)) {
      return;
    }
    
    // Get stream info
    const streamInfo = this.streamUrls.get(streamId);
    
    // Remove stream
    this.streamUrls.delete(streamId);
    
    // Update stats
    this.stats.activeStreams = this.streamUrls.size;
    this.stats.lastActivity = new Date();
    
    // Trigger stream stopped event
    this.eventEmitter.emit(ONVIFEvent.STREAM_STOPPED, {
      streamId,
      profileToken: streamInfo?.profile.token
    });
  }
  
  /**
   * Move camera using PTZ controls
   */
  protected async performMove(movement: PtzMovement): Promise<void> {
    if (!this.device || !this.services.ptzService) {
      throw new Error('Camera is not connected or PTZ service is not available');
    }
    
    try {
      // Find a profile with PTZ configuration
      const ptzProfile = this.profiles.find(p => p.ptzConfiguration);
      if (!ptzProfile) {
        throw new Error('No PTZ configuration found in profiles');
      }
      
      const ptzOptions: any = {
        ProfileToken: ptzProfile.token,
        Speed: {
          PanTilt: { x: 0, y: 0 },
          Zoom: { x: 0 }
        }
      };
      
      // Set speed
      const speed = movement.speed !== undefined ? movement.speed : 1.0;
      
      // Set up movement parameters based on type
      if (movement.continuous) {
        // Continuous move
        ptzOptions.Velocity = {
          PanTilt: {
            x: movement.pan !== undefined ? movement.pan * speed : 0,
            y: movement.tilt !== undefined ? movement.tilt * speed : 0
          },
          Zoom: {
            x: movement.zoom !== undefined ? movement.zoom * speed : 0
          }
        };
        
        // Perform continuous move
        await new Promise<void>((resolve, reject) => {
          this.services.ptzService.continuousMove(ptzOptions, (err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      } else if (movement.absolute) {
        // Absolute move
        ptzOptions.Position = {
          PanTilt: {
            x: movement.pan !== undefined ? movement.pan : 0,
            y: movement.tilt !== undefined ? movement.tilt : 0
          },
          Zoom: {
            x: movement.zoom !== undefined ? movement.zoom : 0
          }
        };
        ptzOptions.Speed = {
          PanTilt: {
            x: speed,
            y: speed
          },
          Zoom: {
            x: speed
          }
        };
        
        // Perform absolute move
        await new Promise<void>((resolve, reject) => {
          this.services.ptzService.absoluteMove(ptzOptions, (err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      } else {
        // Relative move
        ptzOptions.Translation = {
          PanTilt: {
            x: movement.pan !== undefined ? movement.pan : 0,
            y: movement.tilt !== undefined ? movement.tilt : 0
          },
          Zoom: {
            x: movement.zoom !== undefined ? movement.zoom : 0
          }
        };
        ptzOptions.Speed = {
          PanTilt: {
            x: speed,
            y: speed
          },
          Zoom: {
            x: speed
          }
        };
        
        // Perform relative move
        await new Promise<void>((resolve, reject) => {
          this.services.ptzService.relativeMove(ptzOptions, (err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      }
      
      // Update stats
      this.stats.ptzMoveCount++;
      this.stats.lastActivity = new Date();
      
      // Trigger PTZ moved event
      this.eventEmitter.emit(ONVIFEvent.PTZ_MOVED, {
        movement,
        profileToken: ptzProfile.token
      });
    } catch (error) {
      this.logger.error(`Failed to move camera: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Go to a preset position
   */
  protected async performGotoPreset(presetId: string): Promise<void> {
    if (!this.device || !this.services.ptzService) {
      throw new Error('Camera is not connected or PTZ service is not available');
    }
    
    try {
      // Find a profile with PTZ configuration
      const ptzProfile = this.profiles.find(p => p.ptzConfiguration);
      if (!ptzProfile) {
        throw new Error('No PTZ configuration found in profiles');
      }
      
      // Verify preset exists
      if (!this.presets.some(p => p.token === presetId)) {
        throw new Error(`Preset not found: ${presetId}`);
      }
      
      // Go to preset
      await new Promise<void>((resolve, reject) => {
        this.services.ptzService.gotoPreset({
          ProfileToken: ptzProfile.token,
          PresetToken: presetId
        }, (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
      
      // Update stats
      this.stats.lastActivity = new Date();
      
      // Trigger preset recalled event
      this.eventEmitter.emit(ONVIFEvent.PRESET_RECALLED, {
        presetToken: presetId,
        profileToken: ptzProfile.token
      });
    } catch (error) {
      this.logger.error(`Failed to go to preset: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Save current position as preset
   */
  protected async performSavePreset(presetName: string): Promise<string> {
    if (!this.device || !this.services.ptzService) {
      throw new Error('Camera is not connected or PTZ service is not available');
    }
    
    try {
      // Find a profile with PTZ configuration
      const ptzProfile = this.profiles.find(p => p.ptzConfiguration);
      if (!ptzProfile) {
        throw new Error('No PTZ configuration found in profiles');
      }
      
      // Save preset
      const result = await new Promise<any>((resolve, reject) => {
        this.services.ptzService.setPreset({
          ProfileToken: ptzProfile.token,
          PresetName: presetName
        }, (err: Error | null, result: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });
      
      const presetToken = result.PresetToken;
      
      // Update presets list
      await this.getPresets();
      
      // Update stats
      this.stats.presetCount = this.presets.length;
      this.stats.lastActivity = new Date();
      
      // Trigger preset saved event
      this.eventEmitter.emit(ONVIFEvent.PRESET_SAVED, {
        presetToken,
        presetName,
        profileToken: ptzProfile.token
      });
      
      return presetToken;
    } catch (error) {
      this.logger.error(`Failed to save preset: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Test connection to camera
   */
  protected async performTestConnection(config: CameraConfig): Promise<boolean> {
    try {
      // Create and test a temporary ONVIF device
      return new Promise<boolean>((resolve) => {
        try {
          const Cam = onvif.Cam;
          
          if (!Cam) {
            resolve(false);
            return;
          }
          
          // Try to create and initialize the camera
          new Cam({
            hostname: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            timeout: 5000 // Short timeout for test
          }, (err: Error | null, cam: any) => {
            if (err) {
              resolve(false);
              return;
            }
            
            // Try to get device information
            cam.getDeviceInformation((infoErr: Error | null, info: any) => {
              resolve(!infoErr && !!info);
            });
          });
        } catch (error) {
          resolve(false);
        }
      });
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Subscribe to camera events
   */
  protected async performSubscribeToEvents(eventTypes: string[]): Promise<string> {
    if (!this.device || !this.services.eventService) {
      throw new Error('Camera is not connected or event service is not available');
    }
    
    try {
      // Create a subscription
      const result = await new Promise<any>((resolve, reject) => {
        this.services.eventService.createPullPointSubscription((err: Error | null, result: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });
      
      // Generate subscription ID
      const subscriptionId = `onvif-subscription-${uuidv4()}`;
      
      // Store subscription info
      this.onvifEventSubscriptions.set(subscriptionId, {
        reference: result.SubscriptionReference,
        eventTypes,
        lastPoll: new Date()
      });
      
      // Start polling events
      this.startEventPolling(subscriptionId);
      
      // Update stats
      this.stats.activeEvents = this.onvifEventSubscriptions.size;
      this.stats.lastActivity = new Date();
      
      return subscriptionId;
    } catch (error) {
      this.logger.error(`Failed to subscribe to events: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Start polling events for a subscription
   */
  private startEventPolling(subscriptionId: string): void {
    const subscription = this.onvifEventSubscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }
    
    // Set up polling interval
    const pollInterval = 5000; // 5 seconds
    
    const poll = () => {
      if (!this.device || !this.services.eventService) {
        return;
      }
      
      if (!this.onvifEventSubscriptions.has(subscriptionId)) {
        return;
      }
      
      // Poll for events
      this.services.eventService.pullMessages({
        Timeout: pollInterval / 1000,
        MessageLimit: 100
      }, (err: Error | null, result: any) => {
        if (err) {
          this.logger.error(`Event polling error: ${err.message}`);
          return;
        }
        
        // Process events
        if (result && result.NotificationMessage) {
          const messages = Array.isArray(result.NotificationMessage) 
            ? result.NotificationMessage 
            : [result.NotificationMessage];
          
          for (const message of messages) {
            this.processEventMessage(subscriptionId, message);
          }
        }
        
        // Update last poll time
        const sub = this.onvifEventSubscriptions.get(subscriptionId);
        if (sub) {
          sub.lastPoll = new Date();
          this.onvifEventSubscriptions.set(subscriptionId, sub);
        }
        
        // Schedule next poll
        setTimeout(poll, pollInterval);
      });
    };
    
    // Start polling
    poll();
  }
  
  /**
   * Process event message
   */
  private processEventMessage(subscriptionId: string, message: any): void {
    const sub = this.onvifEventSubscriptions.get(subscriptionId);
    if (!sub) {
      return;
    }
    
    try {
      // Extract event data
      const topic = message.Topic?._ || message.Topic;
      const source = message.ProducerReference?.Address?._ || 'unknown';
      const messageData = message.Message?.Message?.Data?.SimpleItem || [];
      
      // Convert data to key-value pairs
      const data: Record<string, any> = {};
      if (Array.isArray(messageData)) {
        for (const item of messageData) {
          if (item.$ && item.$.Name) {
            data[item.$.Name] = item.$.Value;
          }
        }
      } else if (messageData.$ && messageData.$.Name) {
        data[messageData.$.Name] = messageData.$.Value;
      }
      
      // Check if event type matches subscription
      if (sub.eventTypes.length > 0) {
        const eventType = topic.replace(/^tns:/, '');
        if (!sub.eventTypes.some((t: string) => eventType.includes(t))) {
          return;
        }
      }
      
      // Create camera event
      const event: CameraEvent = {
        type: topic.replace(/^tns:/, ''),
        timestamp: new Date(),
        source,
        data
      };
      
      // Dispatch event
      this.dispatchEvent(event);
      
      // Emit internal event
      this.eventEmitter.emit(ONVIFEvent.EVENT_RECEIVED, {
        subscriptionId,
        event
      });
    } catch (error) {
      this.logger.error(`Error processing event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Unsubscribe from camera events
   */
  protected async performUnsubscribeFromEvents(subscriptionId: string): Promise<void> {
    const subscription = this.onvifEventSubscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }
    
    try {
      // Delete subscription
      if (this.services.eventService) {
        await new Promise<void>((resolve, reject) => {
          this.services.eventService.unsubscribe(subscription.reference, (err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      }
    } catch (error) {
      this.logger.warn(`Error unsubscribing: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Remove subscription from map
      this.onvifEventSubscriptions.delete(subscriptionId);
      
      // Update stats
      this.stats.activeEvents = this.onvifEventSubscriptions.size;
      this.stats.lastActivity = new Date();
    }
  }
  
  /**
   * Get device information
   */
  private async getDeviceInformation(): Promise<void> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }
    
    return new Promise<void>((resolve, reject) => {
      this.device!.getDeviceInformation((err: Error | null, info: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Store device information
        this.device!.deviceInformation = info;
        resolve();
      });
    });
  }
  
  /**
   * Get available services
   */
  private async getServices(): Promise<void> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }
    
    // Get device service
    this.services.deviceService = this.device.services.device;
    
    // Get media service
    if (this.device.services.media) {
      this.services.mediaService = this.device.services.media;
    }
    
    // Get PTZ service
    if (this.device.services.ptz) {
      this.services.ptzService = this.device.services.ptz;
    }
    
    // Get event service
    if (this.device.services.events) {
      this.services.eventService = this.device.services.events;
    }
    
    // Get analytics service
    if (this.device.services.analytics) {
      this.services.analyticsService = this.device.services.analytics;
    }
    
    // Get imaging service
    if (this.device.services.imaging) {
      this.services.imagingService = this.device.services.imaging;
    }
  }
  
  /**
   * Get media profiles
   */
  private async getMediaProfiles(): Promise<void> {
    if (!this.services.mediaService) {
      throw new Error('Media service not available');
    }
    
    return new Promise<void>((resolve, reject) => {
      this.services.mediaService.getProfiles((err: Error | null, profiles: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Store profiles
        this.profiles = Array.isArray(profiles) ? profiles : [profiles];
        
        // Update encodings based on profiles
        const encodings = new Set<string>();
        for (const profile of this.profiles) {
          if (profile.videoEncoderConfiguration?.encoding) {
            encodings.add(profile.videoEncoderConfiguration.encoding);
          }
        }
        
        // Update capabilities
        this.capabilities.encodings = Array.from(encodings);
        
        resolve();
      });
    });
  }
  
  /**
   * Get presets
   */
  private async getPresets(): Promise<void> {
    if (!this.services.ptzService) {
      this.presets = [];
      return;
    }
    
    try {
      // Find a profile with PTZ configuration
      const ptzProfile = this.profiles.find(p => p.ptzConfiguration);
      if (!ptzProfile) {
        this.presets = [];
        return;
      }
      
      // Get presets
      const presets = await new Promise<any[]>((resolve, reject) => {
        this.services.ptzService.getPresets({
          ProfileToken: ptzProfile.token
        }, (err: Error | null, presets: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Convert to array if not already
          const presetArray = Array.isArray(presets.Preset) 
            ? presets.Preset 
            : [presets.Preset];
          
          resolve(presetArray);
        });
      });
      
      // Convert to internal format
      this.presets = presets.map(preset => ({
        token: preset.token,
        name: preset.Name,
        position: preset.PTZPosition ? {
          x: preset.PTZPosition.PanTilt?.x || 0,
          y: preset.PTZPosition.PanTilt?.y || 0,
          zoom: preset.PTZPosition.Zoom?.x || 0
        } : undefined
      }));
      
      // Update stats
      this.stats.presetCount = this.presets.length;
    } catch (error) {
      this.logger.error(`Failed to get presets: ${error instanceof Error ? error.message : String(error)}`);
      this.presets = [];
    }
  }
  
  /**
   * Set up event handlers for internal events
   */
  private setupEventHandlers(): void {
    // Handle errors
    this.eventEmitter.on(ONVIFEvent.ERROR, (error) => {
      this.logger.error(`ONVIF error: ${error instanceof Error ? error.message : String(error)}`);
      this.stats.lastError = error instanceof Error ? error.message : String(error);
    });
  }
  
  /**
   * Get ONVIF statistics
   */
  getONVIFStats(): ONVIFStats {
    return { ...this.stats };
  }
}