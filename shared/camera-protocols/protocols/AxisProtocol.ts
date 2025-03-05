import { AbstractCameraProtocol, Logger } from '../AbstractCameraProtocol';
import { CameraCapabilities, CameraEvent, CameraInfo, CameraPreset, ConnectionStatus, PTZCommand, StreamSettings, VideoFrame } from '../types/camera-types';
import axios, { AxiosInstance } from 'axios';
import { parseStringPromise } from 'xml2js';

/**
 * Axis Camera VAPIX API Implementation
 * Supports Axis cameras using the VAPIX HTTP API
 */
export class AxisProtocol extends AbstractCameraProtocol {
  private axiosInstance: AxiosInstance;
  private deviceInfo: any = null;
  private logger: Logger;
  private subscriptions: Map<string, any> = new Map();

  // Protocol identification
  get protocolId(): string {
    return 'axis';
  }
  
  get protocolName(): string {
    return 'Axis VAPIX';
  }

  constructor(config: {
    host: string;
    port?: number;
    username: string;
    password: string;
    https?: boolean;
    logger: Logger;
  }) {
    super({
      id: `axis-${config.host}`,
      name: 'Axis Camera',
      host: config.host,
      port: config.port || 80,
      manufacturer: 'Axis',
      username: config.username,
      password: config.password
    });

    this.logger = config.logger;
    
    // Create HTTP client for camera API
    this.axiosInstance = axios.create({
      baseURL: `${config.https ? 'https' : 'http'}://${config.host}:${config.port || 80}`,
      auth: {
        username: config.username,
        password: config.password
      },
      timeout: 10000
    });
    
    // Initialize capabilities to all false
    this.capabilities = {
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
  }

  /**
   * Connect to the camera and retrieve initial information
   */
  async connect(): Promise<ConnectionStatus> {
    try {
      // Get device information using VAPIX API
      const deviceInfoResponse = await this.axiosInstance.get('/axis-cgi/serverreport.cgi');
      
      if (deviceInfoResponse.status === 200) {
        this.deviceInfo = this.parseServerReport(deviceInfoResponse.data);
        
        // Set camera metadata
        if (this.deviceInfo.DeviceSerialNumber) {
          this.metadata.serialNumber = this.deviceInfo.DeviceSerialNumber;
        }
        
        if (this.deviceInfo.DeviceModel) {
          this.metadata.model = this.deviceInfo.DeviceModel;
          this.metadata.name = `Axis ${this.deviceInfo.DeviceModel}`;
        }
        
        if (this.deviceInfo.FirmwareVersion) {
          this.metadata.firmwareVersion = this.deviceInfo.FirmwareVersion;
        }
        
        // Get capabilities
        await this.fetchCapabilities();
        
        this.logger.info(`Connected to Axis camera: ${this.metadata.name}`, { 
          cameraId: this.metadata.id,
          model: this.metadata.model
        });
        
        return {
          connected: true,
          error: null
        };
      } else {
        throw new Error(`Failed to connect: ${deviceInfoResponse.statusText}`);
      }
    } catch (error) {
      this.logger.error('Error connecting to Axis camera', { 
        cameraId: this.metadata.id,
        error 
      });
      
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Disconnect from the camera
   */
  async disconnect(): Promise<void> {
    // No explicit disconnect needed for HTTP API
    this.logger.info(`Disconnected from Axis camera: ${this.metadata.name}`, { 
      cameraId: this.metadata.id 
    });
  }

  /**
   * Get a single video frame from the camera
   */
  async getFrame(streamId?: string): Promise<VideoFrame | null> {
    try {
      const buffer = await this.getSnapshot(streamId);
      if (!buffer) return null;
      
      // Try to get resolution from parameters
      let width = 1280;
      let height = 720;
      
      // If no parameters, get from stream settings
      if (!width || !height) {
        try {
          const streams = await this.getAvailableStreams();
          const stream = streams.find(s => streamId ? s.id === streamId : true);
          if (stream) {
            width = stream.resolution.width;
            height = stream.resolution.height;
          }
        } catch (e) {
          // Use defaults if we can't get stream settings
        }
      }
      
      return {
        data: buffer,
        timestamp: Date.now(),
        width,
        height,
        format: 'jpeg'
      };
    } catch (error) {
      this.logger.error('Error getting frame', { 
        cameraId: this.metadata.id,
        streamId,
        error
      });
      return null;
    }
  }

  /**
   * Get list of available streams from the camera
   */
  async getAvailableStreams(): Promise<StreamSettings[]> {
    try {
      // Axis cameras have several standard streams
      // We'll create entries for MJPEG, H.264, and snapshot
      const streams: StreamSettings[] = [];
      
      // Get available video sources
      const mediaResponse = await this.axiosInstance.get('/axis-cgi/param.cgi?action=list&group=Properties.Image.Resolution');
      
      if (mediaResponse.status === 200) {
        const resolutions = this.parseParameterList(mediaResponse.data);
        const resolutionValues = resolutions['Properties.Image.Resolution'].split(',');
        
        // Get the highest resolution
        let highestRes = { width: 1920, height: 1080 };
        
        for (const res of resolutionValues) {
          const [width, height] = res.split('x').map(Number);
          if (width && height && (width * height > highestRes.width * highestRes.height)) {
            highestRes = { width, height };
          }
        }
        
        // Main H.264 stream
        streams.push({
          id: 'axis-h264',
          name: 'H.264 Stream',
          url: '/axis-cgi/mjpg/video.cgi',
          type: 'rtsp',
          resolution: highestRes,
          format: 'H.264',
          rtspUrl: `rtsp://${this.metadata.username}:${this.metadata.password}@${this.metadata.host}:554/axis-media/media.amp`
        });
        
        // MJPEG stream
        streams.push({
          id: 'axis-mjpeg',
          name: 'MJPEG Stream',
          url: '/axis-cgi/mjpg/video.cgi',
          type: 'mjpeg',
          resolution: highestRes,
          format: 'MJPEG',
          mjpegUrl: `http://${this.metadata.username}:${this.metadata.password}@${this.metadata.host}/axis-cgi/mjpg/video.cgi`
        });
        
        // Snapshot
        streams.push({
          id: 'axis-snapshot',
          name: 'Snapshot',
          url: '/axis-cgi/jpg/image.cgi',
          type: 'http',
          resolution: highestRes,
          format: 'JPEG',
          httpUrl: `http://${this.metadata.username}:${this.metadata.password}@${this.metadata.host}/axis-cgi/jpg/image.cgi`
        });
      }
      
      return streams;
    } catch (error) {
      this.logger.error('Error getting streams from Axis camera', { 
        cameraId: this.metadata.id, 
        error 
      });
      return [];
    }
  }

  /**
   * Get available camera capabilities
   */
  private async fetchCapabilities(): Promise<void> {
    try {
      // Check PTZ capability
      try {
        const ptzResponse = await this.axiosInstance.get('/axis-cgi/com/ptz.cgi?query=position');
        if (ptzResponse.status === 200) {
          this.capabilities.ptz = true;
          this.capabilities.presets = true;
        }
      } catch (e) {
        // Not a PTZ camera
      }
      
      // Check for audio capability
      try {
        const audioResponse = await this.axiosInstance.get('/axis-cgi/param.cgi?action=list&group=Audio');
        if (audioResponse.status === 200) {
          this.capabilities.audio = true;
          
          // Check for two-way audio
          const audioParams = this.parseParameterList(audioResponse.data);
          if (audioParams['Audio.Input.NbrOfInputs'] && parseInt(audioParams['Audio.Input.NbrOfInputs'], 10) > 0) {
            this.capabilities.twoWayAudio = true;
          }
        }
      } catch (e) {
        // No audio support
      }
      
      // Check for motion detection
      try {
        const motionResponse = await this.axiosInstance.get('/axis-cgi/param.cgi?action=list&group=Motion');
        if (motionResponse.status === 200) {
          this.capabilities.motionDetection = true;
        }
      } catch (e) {
        // No motion detection
      }
      
      // Check for events capability
      try {
        const eventsResponse = await this.axiosInstance.get('/axis-cgi/eventmgr.cgi?action=list');
        if (eventsResponse.status === 200) {
          this.capabilities.events = true;
        }
      } catch (e) {
        // No events support
      }
      
      // Check for I/O ports
      try {
        const ioResponse = await this.axiosInstance.get('/axis-cgi/io/port.cgi?action=list');
        if (ioResponse.status === 200) {
          this.capabilities.ioPorts = true;
        }
      } catch (e) {
        // No I/O ports
      }
      
      // Check for privacy mask capability
      try {
        const privacyResponse = await this.axiosInstance.get('/axis-cgi/param.cgi?action=list&group=PrivacyMask');
        if (privacyResponse.status === 200) {
          this.capabilities.privacyMask = true;
        }
      } catch (e) {
        // No privacy mask support
      }
      
      // Check for WDR capability
      try {
        const wdrResponse = await this.axiosInstance.get('/axis-cgi/param.cgi?action=list&group=Properties.Image.WDR');
        if (wdrResponse.status === 200) {
          this.capabilities.wdr = true;
        }
      } catch (e) {
        // No WDR support
      }
    } catch (error) {
      this.logger.error('Error fetching camera capabilities', { 
        cameraId: this.metadata.id, 
        error 
      });
    }
  }

  /**
   * Execute PTZ command
   */
  async executePTZCommand(command: PTZCommand): Promise<boolean> {
    if (!this.capabilities.ptz) {
      this.logger.warn('Camera does not support PTZ', { cameraId: this.metadata.id });
      return false;
    }
    
    try {
      const ptzParams = new URLSearchParams();
      
      switch (command.action) {
        case 'move':
          // Handle continuous move
          if (command.params?.pan) {
            ptzParams.append('continuouspantiltmove', `${command.params.pan},${command.params.tilt || 0}`);
          }
          if (command.params?.zoom) {
            ptzParams.append('continuouszoommove', `${command.params.zoom}`);
          }
          break;
          
        case 'stop':
          ptzParams.append('continuouspantiltmove', '0,0');
          ptzParams.append('continuouszoommove', '0');
          break;
          
        case 'preset':
          if (command.params?.preset) {
            ptzParams.append('gotoserverpresetno', command.params.preset.toString());
          }
          break;
          
        case 'home':
          ptzParams.append('move', 'home');
          break;
          
        default:
          throw new Error(`Unsupported PTZ action: ${command.action}`);
      }
      
      // Execute PTZ command
      const response = await this.axiosInstance.get(`/axis-cgi/com/ptz.cgi?${ptzParams.toString()}`);
      
      return response.status === 200;
    } catch (error) {
      this.logger.error('Error executing PTZ command', { 
        cameraId: this.metadata.id, 
        command, 
        error 
      });
      return false;
    }
  }

  /**
   * Get available camera presets
   */
  async getPresets(): Promise<CameraPreset[]> {
    if (!this.capabilities.ptz) {
      this.logger.warn('Camera does not support presets', { cameraId: this.metadata.id });
      return [];
    }
    
    try {
      const response = await this.axiosInstance.get('/axis-cgi/com/ptz.cgi?query=presetposcam');
      
      if (response.status !== 200) {
        throw new Error(`Failed to get presets: ${response.statusText}`);
      }
      
      const presets: CameraPreset[] = [];
      const lines = response.data.split('\n');
      
      for (const line of lines) {
        // Format: presetposno=X presetposname="Name"
        const match = line.match(/presetposno=(\d+)\s+presetposname="([^"]+)"/);
        if (match) {
          const [_, id, name] = match;
          presets.push({
            id,
            name
          });
        }
      }
      
      return presets;
    } catch (error) {
      this.logger.error('Error getting presets', { 
        cameraId: this.metadata.id, 
        error 
      });
      return [];
    }
  }

  /**
   * Create a new camera preset
   */
  async createPreset(name: string, position?: any): Promise<CameraPreset | null> {
    if (!this.capabilities.ptz) {
      this.logger.warn('Camera does not support presets', { cameraId: this.metadata.id });
      return null;
    }
    
    try {
      // Get existing presets to find next available ID
      const existingPresets = await this.getPresets();
      let nextId = 1;
      
      while (existingPresets.some(preset => preset.id === nextId.toString())) {
        nextId++;
      }
      
      // Create preset
      const params = new URLSearchParams();
      params.append('action', 'update');
      params.append('presetposno', nextId.toString());
      params.append('presetposname', name);
      
      const response = await this.axiosInstance.get(`/axis-cgi/com/ptz.cgi?${params.toString()}`);
      
      if (response.status === 200) {
        return {
          id: nextId.toString(),
          name
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error creating preset', { 
        cameraId: this.metadata.id, 
        name,
        error 
      });
      return null;
    }
  }

  /**
   * Delete a camera preset
   */
  async deletePreset(presetId: string): Promise<boolean> {
    if (!this.capabilities.ptz) {
      this.logger.warn('Camera does not support presets', { cameraId: this.metadata.id });
      return false;
    }
    
    try {
      const params = new URLSearchParams();
      params.append('action', 'removeserverpresetno');
      params.append('serverpresetno', presetId);
      
      const response = await this.axiosInstance.get(`/axis-cgi/com/ptz.cgi?${params.toString()}`);
      
      return response.status === 200;
    } catch (error) {
      this.logger.error('Error deleting preset', { 
        cameraId: this.metadata.id, 
        presetId,
        error 
      });
      return false;
    }
  }

  /**
   * Get snapshot image from camera
   */
  async getSnapshot(streamId?: string): Promise<Buffer | null> {
    try {
      // Axis snapshots are available via jpg/image.cgi
      // We can optionally request a specific resolution
      let params = '';
      
      // If a specific stream was requested, try to get its resolution
      if (streamId) {
        const streams = await this.getAvailableStreams();
        const stream = streams.find(s => s.id === streamId);
        if (stream) {
          params = `?resolution=${stream.resolution.width}x${stream.resolution.height}`;
        }
      }
      
      const response = await this.axiosInstance.get(`/axis-cgi/jpg/image.cgi${params}`, {
        responseType: 'arraybuffer'
      });
      
      if (response.status === 200) {
        return Buffer.from(response.data);
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error getting snapshot', { 
        cameraId: this.metadata.id, 
        streamId, 
        error 
      });
      return null;
    }
  }

  /**
   * Subscribe to camera events
   */
  async subscribeToEvents(eventTypes: string[]): Promise<string> {
    if (!this.capabilities.events) {
      this.logger.warn('Camera does not support events', { cameraId: this.metadata.id });
      return '';
    }
    
    try {
      // Generate a unique subscription ID
      const subscriptionId = `axis-${Date.now()}`;
      
      // Axis event handling typically involves setting up action rules
      // We need to create a rule that will send HTTP notifications to our server
      
      // First, build the event expression based on requested event types
      let eventExpression = '';
      
      if (eventTypes.length === 0) {
        // Default to detecting all common events
        eventExpression = 'MotionDetection or TamperingDetection or PIRDetection';
      } else {
        eventExpression = eventTypes.join(' or ');
      }
      
      // Create the action rule
      const params = new URLSearchParams();
      params.append('action', 'add');
      params.append('name', `OmniSight-${subscriptionId}`);
      params.append('condition', eventExpression);
      params.append('notification', 'http');
      params.append('destination', process.env.EVENT_RECEIVER_IP || 'localhost');
      params.append('port', process.env.EVENT_RECEIVER_PORT || '8080');
      params.append('path', `/api/events/axis/${this.metadata.id}`);
      params.append('username', process.env.EVENT_RECEIVER_USERNAME || 'admin');
      params.append('password', process.env.EVENT_RECEIVER_PASSWORD || 'admin');
      
      const response = await this.axiosInstance.get(`/axis-cgi/actionengine.cgi?${params.toString()}`);
      
      if (response.status === 200) {
        // Store subscription info
        this.subscriptions.set(subscriptionId, {
          eventTypes,
          ruleName: `OmniSight-${subscriptionId}`
        });
        
        return subscriptionId;
      }
      
      return '';
    } catch (error) {
      this.logger.error('Error subscribing to events', { 
        cameraId: this.metadata.id, 
        eventTypes,
        error 
      });
      return '';
    }
  }

  /**
   * Unsubscribe from camera events
   */
  async unsubscribeFromEvents(subscriptionId: string): Promise<boolean> {
    if (!this.capabilities.events) {
      this.logger.warn('Camera does not support events', { cameraId: this.metadata.id });
      return false;
    }
    
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      
      if (!subscription) {
        this.logger.warn('Subscription not found', { subscriptionId });
        return false;
      }
      
      // Remove the action rule
      const params = new URLSearchParams();
      params.append('action', 'remove');
      params.append('name', subscription.ruleName);
      
      const response = await this.axiosInstance.get(`/axis-cgi/actionengine.cgi?${params.toString()}`);
      
      if (response.status === 200) {
        this.subscriptions.delete(subscriptionId);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Error unsubscribing from events', { 
        cameraId: this.metadata.id, 
        subscriptionId,
        error 
      });
      return false;
    }
  }

  /**
   * Start recording on the camera (if supported)
   */
  async startRecording(options?: any): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/axis-cgi/record.cgi?action=start');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Error starting recording', { 
        cameraId: this.metadata.id, 
        error 
      });
      return false;
    }
  }

  /**
   * Stop recording on the camera (if supported)
   */
  async stopRecording(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/axis-cgi/record.cgi?action=stop');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Error stopping recording', { 
        cameraId: this.metadata.id, 
        error 
      });
      return false;
    }
  }

  /**
   * Reboot the camera
   */
  async reboot(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/axis-cgi/admin/restart.cgi');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Error rebooting camera', { 
        cameraId: this.metadata.id, 
        error 
      });
      return false;
    }
  }

  /**
   * Update camera settings
   */
  async updateSettings(settings: any): Promise<boolean> {
    try {
      const params = new URLSearchParams();
      params.append('action', 'update');
      
      for (const [key, value] of Object.entries(settings)) {
        params.append(key, String(value));
      }
      
      const response = await this.axiosInstance.get(`/axis-cgi/param.cgi?${params.toString()}`);
      return response.status === 200;
    } catch (error) {
      this.logger.error('Error updating camera settings', { 
        cameraId: this.metadata.id, 
        settings,
        error 
      });
      return false;
    }
  }

  /**
   * Parse Axis server report format (key=value\n)
   */
  private parseServerReport(data: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (typeof data === 'string') {
      const lines = data.split('\n');
      
      for (const line of lines) {
        if (line.includes('=')) {
          const [key, value] = line.split('=', 2);
          result[key.trim()] = value.trim();
        }
      }
    }
    
    return result;
  }

  /**
   * Parse Axis parameter list (key=value\n)
   */
  private parseParameterList(data: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (typeof data === 'string') {
      const lines = data.split('\n');
      
      for (const line of lines) {
        if (line.includes('=')) {
          const [key, value] = line.split('=', 2);
          result[key.trim()] = value.trim();
        }
      }
    }
    
    return result;
  }
}