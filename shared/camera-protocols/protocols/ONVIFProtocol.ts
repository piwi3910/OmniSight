import { Cam, Discovery } from 'onvif';
import { EventEmitter } from 'events';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import {
  AbstractCameraProtocol
} from '../AbstractCameraProtocol';
import {
  CameraConfig,
  CameraCapabilities,
  CameraInfo,
  ConnectionStatus,
  PtzMovement,
  StreamOptions,
  StreamProfile,
  CameraEvent
} from '../interfaces/ICameraProtocol';

/**
 * Type for ONVIF Camera instance
 */
type ONVIFCam = any; // The ONVIF library doesn't provide proper TypeScript definitions

/**
 * ONVIF-specific presets map
 */
interface PresetMap {
  [presetToken: string]: string; // Token -> Name
}

/**
 * ONVIF protocol implementation
 * 
 * This class implements the ICameraProtocol interface for ONVIF-compatible cameras.
 * ONVIF is a global standard that enables interoperability between IP-based security products
 * regardless of manufacturer.
 */
export class ONVIFProtocol extends AbstractCameraProtocol {
  /**
   * Protocol identifier
   */
  public readonly protocolId: string = 'onvif';
  
  /**
   * Protocol name
   */
  public readonly protocolName: string = 'ONVIF';
  
  /**
   * Protocol capabilities (will be updated after connection)
   */
  public readonly capabilities: CameraCapabilities = {
    ptz: false,
    presets: false,
    digitalPtz: true,
    motionDetection: false,
    audio: false,
    twoWayAudio: false,
    encodings: ['h264', 'h265', 'mjpeg'],
    authMethods: ['digest', 'wsse'],
    localRecording: false,
    events: true,
    protocolSpecific: {
      discoverable: true,
      onvifProfiles: []
    }
  };
  
  /**
   * ONVIF camera instance
   */
  private cam: ONVIFCam | null = null;
  
  /**
   * ONVIF stream URI cache
   */
  private streamUriCache: Map<string, string> = new Map();
  
  /**
   * ONVIF profiles cache
   */
  private profilesCache: any[] = [];
  
  /**
   * ONVIF presets cache
   */
  private presetsCache: PresetMap = {};
  
  /**
   * ONVIF default profile token
   */
  private defaultProfileToken: string | null = null;
  
  /**
   * Camera info cache
   */
  private cameraInfoCache: CameraInfo | null = null;
  
  /**
   * Event subscription server
   */
  private eventServer: http.Server | null = null;
  
  /**
   * Event emitter for ONVIF events
   */
  private eventEmitter: EventEmitter = new EventEmitter();
  
  /**
   * Active streams map
   */
  protected activeStreams: Map<string, {
    uri: string;
    profileToken: string;
    options?: StreamOptions;
  }> = new Map();
  
  /**
   * Connect to ONVIF camera
   * 
   * @param config Camera configuration
   */
  protected async performConnect(config: CameraConfig): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        // Create ONVIF camera instance
        const camOptions = {
          hostname: config.host,
          port: config.port || 80,
          username: config.username,
          password: config.password,
          timeout: config.timeout || 10000
        };
        
        // Create camera instance
        this.cam = new Cam(camOptions, async (err: Error | null) => {
          if (err) {
            console.error('ONVIF connection error:', err);
            resolve(false);
            return;
          }
          
          try {
            // Get camera capabilities
            await this.updateCapabilities();
            
            // Get camera profiles
            await this.getProfiles();
            
            // Get camera presets if PTZ capable
            if (this.capabilities.ptz) {
              await this.getPresets();
            }
            
            resolve(true);
          } catch (error) {
            console.error('ONVIF initialization error:', error);
            resolve(false);
          }
        });
      } catch (error) {
        console.error('ONVIF connection error:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * Update camera capabilities
   */
  private async updateCapabilities(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.cam) {
        reject(new Error('Camera not connected'));
        return;
      }
      
      this.cam.getCapabilities((err: Error | null, capabilities: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Update capabilities based on ONVIF response
        const hasPtz = !!(capabilities.PTZ && capabilities.PTZ.XAddr);
        const hasEvents = !!(capabilities.Events && capabilities.Events.XAddr);
        const hasAudio = !!(capabilities.Media && capabilities.Media.XAddr && 
                           capabilities.Media.extension && 
                           capabilities.Media.extension.AudioOutputs);
        
        // Update capabilities
        (this.capabilities as any).ptz = hasPtz;
        (this.capabilities as any).presets = hasPtz;
        (this.capabilities as any).events = hasEvents;
        (this.capabilities as any).audio = hasAudio;
        (this.capabilities as any).protocolSpecific = {
          ...(this.capabilities.protocolSpecific || {}),
          capabilities,
          hasPtz,
          hasEvents,
          hasAudio
        };
        
        resolve();
      });
    });
  }
  
  /**
   * Get camera profiles
   */
  private async getProfiles(): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      if (!this.cam) {
        reject(new Error('Camera not connected'));
        return;
      }
      
      this.cam.getProfiles((err: Error | null, profiles: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.profilesCache = profiles;
        
        // Update protocol specific capabilities
        (this.capabilities.protocolSpecific as any).onvifProfiles = 
          profiles.map(p => ({ token: p.$.token, name: p.name }));
        
        // Set default profile (first one)
        if (profiles.length > 0) {
          this.defaultProfileToken = profiles[0].$.token;
        }
        
        resolve(profiles);
      });
    });
  }
  
  /**
   * Get camera presets
   */
  private async getPresets(): Promise<PresetMap> {
    return new Promise<PresetMap>((resolve, reject) => {
      if (!this.cam || !this.defaultProfileToken) {
        reject(new Error('Camera not connected or no profile available'));
        return;
      }
      
      this.cam.getPresets({ profileToken: this.defaultProfileToken }, (err: Error | null, presets: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        const presetMap: PresetMap = {};
        
        // Extract presets
        if (presets && typeof presets === 'object') {
          Object.keys(presets).forEach(name => {
            const token = presets[name];
            presetMap[token] = name;
          });
        }
        
        this.presetsCache = presetMap;
        resolve(presetMap);
      });
    });
  }
  
  /**
   * Get stream URI for profile
   * 
   * @param profileToken Profile token
   * @param protocol Stream protocol (RTSP, HTTP, UDP)
   */
  private async getStreamUri(profileToken: string, protocol: 'RTSP' | 'HTTP' | 'UDP' = 'RTSP'): Promise<string> {
    // Check cache first
    const cacheKey = `${profileToken}:${protocol}`;
    if (this.streamUriCache.has(cacheKey)) {
      return this.streamUriCache.get(cacheKey)!;
    }
    
    return new Promise<string>((resolve, reject) => {
      if (!this.cam) {
        reject(new Error('Camera not connected'));
        return;
      }
      
      this.cam.getStreamUri({
        protocol,
        profileToken
      }, (err: Error | null, stream: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!stream || !stream.uri) {
          reject(new Error('No stream URI found'));
          return;
        }
        
        // Cache the URI
        this.streamUriCache.set(cacheKey, stream.uri);
        
        resolve(stream.uri);
      });
    });
  }
  
  /**
   * Disconnect from camera
   */
  protected async performDisconnect(): Promise<void> {
    // Stop all active streams
    this.activeStreams.clear();
    
    // Cleanup event subscription
    if (this.eventServer) {
      this.eventServer.close();
      this.eventServer = null;
    }
    
    // Clean up
    this.cam = null;
    this.streamUriCache.clear();
    this.profilesCache = [];
    this.presetsCache = {};
    this.defaultProfileToken = null;
  }
  
  /**
   * Start camera stream
   * 
   * @param options Stream options
   */
  protected async performStartStream(options?: StreamOptions): Promise<string> {
    if (!this.cam) {
      throw new Error('Camera not connected');
    }
    
    // Determine profile token to use
    let profileToken = this.defaultProfileToken;
    
    // If profile specified in options, use that
    if (options?.profile) {
      profileToken = options.profile;
    } else if (options?.resolution && this.profilesCache.length > 0) {
      // Try to find a profile matching desired resolution
      const targetWidth = options.resolution.width;
      const targetHeight = options.resolution.height;
      
      // Find closest match by resolution
      let bestMatch = this.profilesCache[0];
      let bestDiff = Number.MAX_SAFE_INTEGER;
      
      for (const profile of this.profilesCache) {
        if (profile.videoEncoderConfiguration && 
            profile.videoEncoderConfiguration.resolution) {
          const width = profile.videoEncoderConfiguration.resolution.width;
          const height = profile.videoEncoderConfiguration.resolution.height;
          
          const diff = Math.abs(width - targetWidth) + Math.abs(height - targetHeight);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestMatch = profile;
          }
        }
      }
      
      profileToken = bestMatch.$.token;
    }
    
    if (!profileToken) {
      throw new Error('No suitable profile found');
    }
    
    // Determine stream protocol (RTSP is preferred)
    const protocol = (options?.parameters?.protocol as any) || 'RTSP';
    
    // Get stream URI
    const uri = await this.getStreamUri(profileToken, protocol);
    
    // Generate stream ID
    const streamId = `stream-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Store stream info
    this.activeStreams.set(streamId, {
      uri,
      profileToken,
      options
    });
    
    return streamId;
  }
  
  /**
   * Stop camera stream
   * 
   * @param streamId Stream identifier
   */
  protected async performStopStream(streamId: string): Promise<void> {
    // Just remove it from active streams
    this.activeStreams.delete(streamId);
  }
  
  /**
   * Get frame from camera (snapshot)
   */
  public async getFrame(): Promise<Uint8Array> {
    if (!this.cam || !this.defaultProfileToken) {
      throw new Error('Camera not connected or no profile available');
    }
    
    return new Promise<Uint8Array>((resolve, reject) => {
      this.cam.getSnapshot({ profileToken: this.defaultProfileToken }, (err: Error | null, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!res || !res.uri) {
          reject(new Error('No snapshot URI available'));
          return;
        }
        
        // Get snapshot using Axios
        axios({
          method: 'GET',
          url: res.uri,
          responseType: 'arraybuffer',
          auth: this.config ? {
            username: this.config.username || '',
            password: this.config.password || ''
          } : undefined
        })
          .then(response => {
            resolve(new Uint8Array(response.data));
          })
          .catch(error => {
            reject(error);
          });
      });
    });
  }
  
  /**
   * Get camera information
   */
  public async getCameraInfo(): Promise<CameraInfo> {
    if (this.cameraInfoCache) {
      return this.cameraInfoCache;
    }
    
    if (!this.cam) {
      throw new Error('Camera not connected');
    }
    
    return new Promise<CameraInfo>((resolve, reject) => {
      this.cam.getDeviceInformation((err: Error | null, info: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        const cameraInfo: CameraInfo = {
          manufacturer: info.manufacturer || 'Unknown',
          model: info.model || 'ONVIF Camera',
          firmwareVersion: info.firmwareVersion || 'Unknown',
          serialNumber: info.serialNumber,
          hardwareId: info.hardwareId,
          additionalInfo: {
            protocol: this.protocolName
          }
        };
        
        this.cameraInfoCache = cameraInfo;
        resolve(cameraInfo);
      });
    });
  }
  
  /**
   * Get available stream profiles
   */
  public async getAvailableStreams(): Promise<StreamProfile[]> {
    if (!this.cam) {
      throw new Error('Camera not connected');
    }
    
    // Use cache if available
    if (this.profilesCache.length > 0) {
      return this.mapProfilesToStreamProfiles(this.profilesCache);
    }
    
    // Otherwise, get profiles
    const profiles = await this.getProfiles();
    return this.mapProfilesToStreamProfiles(profiles);
  }
  
  /**
   * Map ONVIF profiles to StreamProfile interface
   * 
   * @param profiles ONVIF profiles
   */
  private mapProfilesToStreamProfiles(profiles: any[]): StreamProfile[] {
    return profiles.map(profile => {
      const token = profile.$.token;
      const name = profile.name || `Profile ${token}`;
      let encoding = 'h264'; // Default
      let width = 640; // Default
      let height = 480; // Default
      let frameRate = 30; // Default
      let bitrate = 1000; // Default in kbps
      
      // Extract video encoder configuration
      if (profile.videoEncoderConfiguration) {
        const config = profile.videoEncoderConfiguration;
        
        // Get encoding
        if (config.encoding) {
          encoding = config.encoding.toLowerCase();
        }
        
        // Get resolution
        if (config.resolution) {
          width = config.resolution.width;
          height = config.resolution.height;
        }
        
        // Get frame rate
        if (config.rateControl && config.rateControl.frameRateLimit) {
          frameRate = config.rateControl.frameRateLimit;
        }
        
        // Get bitrate
        if (config.rateControl && config.rateControl.bitrateLimit) {
          bitrate = config.rateControl.bitrateLimit;
        }
      }
      
      return {
        id: token,
        name,
        encoding,
        resolution: { width, height },
        frameRate,
        bitrate,
        parameters: {
          profileToken: token,
          protocol: 'RTSP',
          hasMetadata: !!profile.metadataConfiguration
        }
      };
    });
  }
  
  /**
   * Get protocol-specific options
   */
  public getProtocolOptions(): Record<string, any> {
    return {
      // ONVIF-specific options
      defaultProfileToken: this.defaultProfileToken,
      availableProfiles: this.capabilities.protocolSpecific?.onvifProfiles || [],
      ptzCapabilities: this.capabilities.ptz,
      eventCapabilities: this.capabilities.events
    };
  }
  
  /**
   * Set protocol-specific options
   * 
   * @param options Protocol options
   */
  public async setProtocolOptions(options: Record<string, any>): Promise<void> {
    if (options.defaultProfileToken && 
        this.profilesCache.some(p => p.$.token === options.defaultProfileToken)) {
      this.defaultProfileToken = options.defaultProfileToken;
    }
  }
  
  /**
   * Perform camera movement
   * 
   * @param movement PTZ movement parameters
   */
  protected async performMove(movement: PtzMovement): Promise<void> {
    if (!this.cam || !this.defaultProfileToken) {
      throw new Error('Camera not connected or no profile available');
    }
    
    if (!this.capabilities.ptz) {
      throw new Error('Camera does not support PTZ');
    }
    
    return new Promise<void>((resolve, reject) => {
      // Translate our movement coordinates to ONVIF coordinates
      const x = movement.pan || 0; // -1 to 1
      const y = movement.tilt || 0; // -1 to 1
      const z = movement.zoom || 0; // -1 to 1
      
      // Get profileToken
      const profileToken = this.defaultProfileToken as string;
      
      // Determine if absolute or relative movement
      if (movement.absolute) {
        // Absolute move
        this.cam.absoluteMove({
          profileToken,
          position: { x, y, zoom: z },
          speed: { x: movement.speed || 1, y: movement.speed || 1, z: movement.speed || 1 }
        }, (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      } else if (movement.continuous) {
        // Continuous move
        this.cam.continuousMove({
          profileToken,
          velocity: { x, y, zoom: z }
        }, (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      } else {
        // Relative move
        this.cam.relativeMove({
          profileToken,
          translation: { x, y, zoom: z },
          speed: { x: movement.speed || 1, y: movement.speed || 1, z: movement.speed || 1 }
        }, (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }
    });
  }
  
  /**
   * Go to preset position
   * 
   * @param presetId Preset identifier
   */
  protected async performGotoPreset(presetId: string): Promise<void> {
    if (!this.cam || !this.defaultProfileToken) {
      throw new Error('Camera not connected or no profile available');
    }
    
    if (!this.capabilities.ptz) {
      throw new Error('Camera does not support PTZ');
    }
    
    return new Promise<void>((resolve, reject) => {
      this.cam.gotoPreset({
        profileToken: this.defaultProfileToken,
        presetToken: presetId
      }, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
  
  /**
   * Save current position as preset
   * 
   * @param presetName Preset name
   */
  protected async performSavePreset(presetName: string): Promise<string> {
    if (!this.cam || !this.defaultProfileToken) {
      throw new Error('Camera not connected or no profile available');
    }
    
    if (!this.capabilities.ptz) {
      throw new Error('Camera does not support PTZ');
    }
    
    return new Promise<string>((resolve, reject) => {
      this.cam.setPreset({
        profileToken: this.defaultProfileToken,
        presetName
      }, (err: Error | null, preset: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Refresh presets
        this.getPresets().catch(console.error);
        
        // Return preset token
        resolve(preset.presetToken);
      });
    });
  }
  
  /**
   * Test connection to camera
   * 
   * @param config Camera configuration
   */
  protected async performTestConnection(config: CameraConfig): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        // Create ONVIF camera instance for testing
        const camOptions = {
          hostname: config.host,
          port: config.port || 80,
          username: config.username,
          password: config.password,
          timeout: config.timeout || 5000
        };
        
        // Create camera instance
        const testCam = new Cam(camOptions, (err: Error | null) => {
          if (err) {
            resolve(false);
            return;
          }
          
          // Get device information as a connection test
          testCam.getDeviceInformation((infoErr: Error | null) => {
            resolve(!infoErr);
          });
        });
      } catch (error) {
        resolve(false);
      }
    });
  }
  
  /**
   * Subscribe to camera events
   * 
   * @param eventTypes Event types to subscribe to
   */
  protected async performSubscribeToEvents(eventTypes: string[]): Promise<string> {
    if (!this.cam) {
      throw new Error('Camera not connected');
    }
    
    if (!this.capabilities.events) {
      throw new Error('Camera does not support events');
    }
    
    // Generate subscription ID
    const subscriptionId = `sub-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Setup event listener
    this.cam.on('event', (event: any) => {
      // Convert ONVIF event to our format
      const cameraEvent: CameraEvent = {
        type: event.topic ? event.topic._: 'unknown',
        timestamp: new Date(),
        source: `onvif:${this.config?.host}`,
        data: event.message || {}
      };
      
      // Emit to our handlers
      this.dispatchEvent(cameraEvent);
    });
    
    return subscriptionId;
  }
  
  /**
   * Unsubscribe from camera events
   * 
   * @param subscriptionId Subscription identifier
   */
  protected async performUnsubscribeFromEvents(subscriptionId: string): Promise<void> {
    if (!this.cam) {
      return;
    }
    
    // Remove event listeners
    this.cam.removeAllListeners('event');
  }
  
  /**
   * Discover ONVIF devices on the network
   * 
   * @param timeout Discovery timeout in ms
   * @returns List of discovered devices
   */
  public static async discoverDevices(timeout: number = 5000): Promise<any[]> {
    return new Promise<any[]>((resolve) => {
      const devices: any[] = [];
      
      Discovery.probe({ timeout }, (err: Error | null, result: any) => {
        if (err || !result) {
          resolve(devices);
          return;
        }
        
        // Add discovered device
        devices.push(result);
      });
      
      // Resolve after timeout
      setTimeout(() => {
        resolve(devices);
      }, timeout + 1000);
    });
  }
}