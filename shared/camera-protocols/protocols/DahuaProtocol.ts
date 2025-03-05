import { AbstractCameraProtocol, Logger } from '../AbstractCameraProtocol';
import { CameraCapabilities, CameraEvent, CameraInfo, CameraPreset, ConnectionStatus, PTZCommand, StreamSettings, VideoFrame } from '../types/camera-types';
import axios, { AxiosInstance } from 'axios';

/**
 * Dahua Camera SDK Implementation
 * Supports Dahua's HTTP API
 */
export class DahuaProtocol extends AbstractCameraProtocol {
  private axiosInstance: AxiosInstance;
  private sessionId: string | null = null;
  private deviceInfo: any = null;
  private logger: Logger;
  private subscriptions: Map<string, any> = new Map();

  // Protocol identification
  get protocolId(): string {
    return 'dahua';
  }
  
  get protocolName(): string {
    return 'Dahua HTTP API';
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
      id: `dahua-${config.host}`,
      name: 'Dahua Camera',
      host: config.host,
      port: config.port || 80,
      manufacturer: 'Dahua',
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
      // Dahua uses a cookie-based authentication system
      const authResponse = await this.axiosInstance.get('/cgi-bin/global.cgi?action=login');
      
      if (authResponse.status === 200) {
        // Extract session ID from cookies
        if (authResponse.headers['set-cookie']) {
          const sessionIdMatch = authResponse.headers['set-cookie'].find(cookie => 
            cookie.includes('DhWebClientSessionID='));
          if (sessionIdMatch) {
            this.sessionId = sessionIdMatch.split('=')[1].split(';')[0];
          }
        }
        
        // Get device information
        const deviceInfoResponse = await this.axiosInstance.get(
          '/cgi-bin/magicBox.cgi?action=getDeviceType'
        );
        
        if (deviceInfoResponse.status === 200) {
          this.deviceInfo = {
            deviceType: deviceInfoResponse.data.split('=')[1]
          };
          
          // Set camera name
          this.metadata.model = this.deviceInfo.deviceType;
          
          // Get more detailed device info
          const detailResponse = await this.axiosInstance.get(
            '/cgi-bin/magicBox.cgi?action=getSystemInfo'
          );
          
          if (detailResponse.status === 200) {
            const systemInfo = this.parseResponseText(detailResponse.data);
            if (systemInfo.deviceName) {
              this.metadata.name = systemInfo.deviceName;
            }
            if (systemInfo.serialNumber) {
              this.metadata.serialNumber = systemInfo.serialNumber;
            }
            if (systemInfo.version) {
              this.metadata.firmwareVersion = systemInfo.version;
            }
          }
          
          // Get capabilities
          await this.fetchCapabilities();
          
          this.logger.info(`Connected to Dahua camera: ${this.metadata.name}`, { 
            cameraId: this.metadata.id,
            model: this.metadata.model
          });
          
          return {
            connected: true,
            error: null
          };
        }
      }
      
      throw new Error('Failed to authenticate with camera');
    } catch (error) {
      this.logger.error('Error connecting to Dahua camera', { 
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
    try {
      if (this.sessionId) {
        await this.axiosInstance.get('/cgi-bin/global.cgi?action=logout');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from Dahua camera', { 
        cameraId: this.metadata.id,
        error 
      });
    } finally {
      this.sessionId = null;
      this.logger.info(`Disconnected from Dahua camera: ${this.metadata.name}`, { 
        cameraId: this.metadata.id 
      });
    }
  }

  /**
   * Get a single video frame from the camera
   */
  async getFrame(streamId?: string): Promise<VideoFrame | null> {
    try {
      const buffer = await this.getSnapshot(streamId);
      if (!buffer) return null;
      
      // Default resolution if we can't determine it
      let width = 1920;
      let height = 1080;
      
      // Try to get resolution from stream info
      try {
        const streams = await this.getAvailableStreams();
        const stream = streams.find(s => (streamId ? s.id === streamId : true));
        if (stream) {
          width = stream.resolution.width;
          height = stream.resolution.height;
        }
      } catch (e) {
        // Ignore error, use default resolution
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
      // Get video encoder configuration
      const response = await this.axiosInstance.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=Encode'
      );
      
      if (response.status !== 200) {
        throw new Error(`Failed to get encoder configuration: ${response.statusText}`);
      }
      
      const config = this.parseResponseText(response.data);
      const streams: StreamSettings[] = [];
      
      // Parse configuration for mainstream, substream1, substream2
      const streamTypes = ['Main', 'Extra1', 'Extra2', 'Extra3', 'Snap'];
      
      for (const streamType of streamTypes) {
        const streamConfig = config[`Encode[0].${streamType}Format[0]`];
        if (streamConfig) {
          const resolution = this.parseResolution(config[`Encode[0].${streamType}Format[0].Resolution`]);
          
          streams.push({
            id: `dahua-stream-${streamType.toLowerCase()}`,
            name: streamType === 'Main' ? 'Main Stream' : 
                 streamType === 'Extra1' ? 'Sub Stream 1' : 
                 streamType === 'Extra2' ? 'Sub Stream 2' : 
                 streamType === 'Extra3' ? 'Sub Stream 3' : 'Snapshot Stream',
            url: streamType === 'Main' ? '/cam/realmonitor?channel=1&subtype=0' : 
                streamType === 'Extra1' ? '/cam/realmonitor?channel=1&subtype=1' : 
                streamType === 'Extra2' ? '/cam/realmonitor?channel=1&subtype=2' :
                streamType === 'Extra3' ? '/cam/realmonitor?channel=1&subtype=3' : '/cgi-bin/snapshot.cgi',
            type: 'rtsp',
            resolution,
            format: config[`Encode[0].${streamType}Format[0].Compression`] || 'H.264',
            rtspUrl: `rtsp://${this.metadata.username}:${this.metadata.password}@${this.metadata.host}:554/cam/realmonitor?channel=1&subtype=${
              streamType === 'Main' ? '0' : 
              streamType === 'Extra1' ? '1' : 
              streamType === 'Extra2' ? '2' : 
              streamType === 'Extra3' ? '3' : '0'
            }`
          });
        }
      }
      
      return streams;
    } catch (error) {
      this.logger.error('Error getting streams from Dahua camera', { 
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
      // PTZ capabilities
      const ptzResponse = await this.axiosInstance.get(
        '/cgi-bin/ptz.cgi?action=getStatus'
      );
      
      if (ptzResponse.status === 200) {
        this.capabilities.ptz = true;
        this.capabilities.presets = true;
      }
      
      // Audio capabilities
      const audioResponse = await this.axiosInstance.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=AudioOutput'
      );
      
      if (audioResponse.status === 200) {
        this.capabilities.audio = true;
      }
      
      // Check 2-way audio
      const talkResponse = await this.axiosInstance.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=AudioTalk'
      );
      
      if (talkResponse.status === 200) {
        this.capabilities.twoWayAudio = true;
      }
      
      // Check motion detection
      const motionResponse = await this.axiosInstance.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=MotionDetect'
      );
      
      if (motionResponse.status === 200) {
        this.capabilities.motionDetection = true;
      }
      
      // Event capabilities
      const eventResponse = await this.axiosInstance.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=AlarmServer'
      );
      
      if (eventResponse.status === 200) {
        this.capabilities.events = true;
      }
      
      // Privacy mask capabilities
      const privacyResponse = await this.axiosInstance.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=PrivacyMasking'
      );
      
      if (privacyResponse.status === 200) {
        this.capabilities.privacyMask = true;
      }
      
      // WDR capabilities
      const wdrResponse = await this.axiosInstance.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=VideoInOptions'
      );
      
      if (wdrResponse.status === 200) {
        const config = this.parseResponseText(wdrResponse.data);
        if (config['VideoInOptions[0].Backlight[0].Mode'] === 'WDR') {
          this.capabilities.wdr = true;
        }
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
      let action = '';
      let params = '';
      
      switch (command.action) {
        case 'move':
          action = 'start';
          if (command.params?.pan && command.params?.pan !== 0) {
            params += command.params.pan > 0 ? 'right' : 'left';
          }
          if (command.params?.tilt && command.params?.tilt !== 0) {
            params += command.params.tilt > 0 ? 'up' : 'down';
          }
          if (command.params?.zoom && command.params?.zoom !== 0) {
            params += command.params.zoom > 0 ? 'zoomin' : 'zoomout';
          }
          
          // Add speed parameter if provided
          if (command.params?.speed) {
            params += `&speed=${command.params.speed}`;
          }
          break;
          
        case 'stop':
          action = 'stop';
          break;
          
        case 'preset':
          if (command.params?.preset) {
            action = 'goto';
            params = `&code=${command.params.preset}`;
          }
          break;
          
        case 'home':
          action = 'goto';
          params = '&code=0';
          break;
          
        default:
          throw new Error(`Unsupported PTZ action: ${command.action}`);
      }
      
      if (!action) {
        throw new Error('Invalid PTZ command parameters');
      }
      
      const response = await this.axiosInstance.get(
        `/cgi-bin/ptz.cgi?action=${action}${params ? `&${params}` : ''}&channel=1`
      );
      
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
      const response = await this.axiosInstance.get(
        '/cgi-bin/ptz.cgi?action=getPresets&channel=1'
      );
      
      if (response.status !== 200) {
        throw new Error(`Failed to get presets: ${response.statusText}`);
      }
      
      const presetData = this.parseResponseText(response.data);
      const presets: CameraPreset[] = [];
      
      // Parse presets from response
      for (const key in presetData) {
        if (key.startsWith('PresetName')) {
          const presetNumber = key.match(/\[(\d+)\]/)?.[1];
          if (presetNumber) {
            presets.push({
              id: presetNumber,
              name: presetData[key] || `Preset ${presetNumber}`
            });
          }
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
      // Get existing presets to find available slot
      const existingPresets = await this.getPresets();
      
      // Find the lowest unused preset number
      let presetNumber = 1;
      while (existingPresets.some(preset => preset.id === presetNumber.toString())) {
        presetNumber++;
      }
      
      // Create preset
      const response = await this.axiosInstance.get(
        `/cgi-bin/ptz.cgi?action=setPreset&channel=1&code=${presetNumber}&name=${encodeURIComponent(name)}`
      );
      
      if (response.status === 200) {
        return {
          id: presetNumber.toString(),
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
      const response = await this.axiosInstance.get(
        `/cgi-bin/ptz.cgi?action=removePreset&channel=1&code=${presetId}`
      );
      
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
      // Determine channel from stream ID, default to channel 1
      const channel = '1';
      
      // Dahua snapshots are available via the snapshot CGI
      const response = await this.axiosInstance.get('/cgi-bin/snapshot.cgi', {
        params: { channel },
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
      const subscriptionId = `dahua-${Date.now()}`;
      
      // For Dahua, we need to configure event subscription settings first
      const eventServer = {
        Address: process.env.EVENT_RECEIVER_IP || 'localhost',
        Port: parseInt(process.env.EVENT_RECEIVER_PORT || '8080', 10),
        Protocol: 'HTTP'
      };
      
      // Configure event server
      const eventServerPath = '/cgi-bin/configManager.cgi?action=setConfig&name=AlarmServer';
      const eventServerParams = new URLSearchParams();
      eventServerParams.append('AlarmServer.Address', eventServer.Address);
      eventServerParams.append('AlarmServer.Port', eventServer.Port.toString());
      eventServerParams.append('AlarmServer.Protocol', eventServer.Protocol);
      
      const configResponse = await this.axiosInstance.post(eventServerPath, eventServerParams);
      
      if (configResponse.status !== 200) {
        throw new Error(`Failed to configure event server: ${configResponse.statusText}`);
      }
      
      // Enable event types
      const enablePromises = eventTypes.map(eventType => {
        const eventPath = `/cgi-bin/configManager.cgi?action=setConfig&name=${eventType}`;
        const eventParams = new URLSearchParams();
        eventParams.append(`${eventType}[0].Enable`, 'true');
        eventParams.append(`${eventType}[0].EventHandler.AlarmServer`, 'true');
        
        return this.axiosInstance.post(eventPath, eventParams);
      });
      
      await Promise.all(enablePromises);
      
      // Store subscription info
      this.subscriptions.set(subscriptionId, {
        eventTypes,
        eventServer
      });
      
      return subscriptionId;
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
      
      // Disable event types
      const disablePromises = subscription.eventTypes.map(eventType => {
        const eventPath = `/cgi-bin/configManager.cgi?action=setConfig&name=${eventType}`;
        const eventParams = new URLSearchParams();
        eventParams.append(`${eventType}[0].EventHandler.AlarmServer`, 'false');
        
        return this.axiosInstance.post(eventPath, eventParams);
      });
      
      await Promise.all(disablePromises);
      
      // Remove subscription
      this.subscriptions.delete(subscriptionId);
      
      return true;
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
      const response = await this.axiosInstance.get(
        '/cgi-bin/recordManager.cgi?action=startManualRecord&channel=1'
      );
      
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
      const response = await this.axiosInstance.get(
        '/cgi-bin/recordManager.cgi?action=stopManualRecord&channel=1'
      );
      
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
      const response = await this.axiosInstance.get(
        '/cgi-bin/magicBox.cgi?action=reboot'
      );
      
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
      const configPromises = Object.entries(settings).map(([key, value]) => {
        const configPath = `/cgi-bin/configManager.cgi?action=setConfig&${key}=${encodeURIComponent(String(value))}`;
        return this.axiosInstance.get(configPath);
      });
      
      const responses = await Promise.all(configPromises);
      
      return responses.every(response => response.status === 200);
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
   * Helper method to parse Dahua's custom response format
   * which has lines like "key=value" 
   */
  private parseResponseText(responseText: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (typeof responseText === 'string') {
      const lines = responseText.split('\r\n');
      
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
   * Helper to parse resolution strings like "1920x1080" or "960P"
   */
  private parseResolution(resolution: string): { width: number; height: number } {
    // Standard resolution format (e.g., "1920x1080")
    const match = resolution?.match(/(\d+)[xX](\d+)/);
    if (match) {
      return {
        width: parseInt(match[1], 10),
        height: parseInt(match[2], 10)
      };
    }
    
    // Shorthand format (e.g., "1080P", "4K")
    switch (resolution?.toUpperCase()) {
      case 'QCIF': return { width: 176, height: 144 };
      case 'CIF': return { width: 352, height: 288 };
      case 'D1': return { width: 704, height: 576 };
      case '960P': return { width: 1280, height: 960 };
      case '720P': return { width: 1280, height: 720 };
      case '1080P': return { width: 1920, height: 1080 };
      case '4K': return { width: 3840, height: 2160 };
      default: return { width: 1280, height: 720 }; // Default to HD
    }
  }
}