import { AbstractCameraProtocol, Logger } from '../AbstractCameraProtocol';
import { CameraCapability, CameraEvent, CameraInfo, CameraPreset, ConnectionStatus, PTZCommand, StreamSettings, VideoFrame } from '../types/camera-types';
import axios, { AxiosInstance } from 'axios';
import { parseStringPromise } from 'xml2js';

/**
 * Hikvision Camera SDK implementation
 * Supports Hikvision's HTTP API and ISAPI
 */
export class HikvisionProtocol extends AbstractCameraProtocol {
  private axiosInstance: AxiosInstance;
  private sessionId: string | null = null;
  private deviceInfo: any = null;
  private logger: Logger;
  private subscriptions: Map<string, any> = new Map();

  // Protocol identification
  get protocolId(): string {
    return 'hikvision';
  }
  
  get protocolName(): string {
    return 'Hikvision ISAPI';
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
      id: `hikvision-${config.host}`,
      name: 'Hikvision Camera',
      host: config.host,
      port: config.port || 80,
      manufacturer: 'Hikvision',
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
      timeout: 10000,
      headers: {
        'Content-Type': 'application/xml'
      }
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
      // Try to get device info to verify connection
      const deviceInfoResponse = await this.axiosInstance.get('/ISAPI/System/deviceInfo');
      
      if (deviceInfoResponse.status === 200) {
        // Parse XML response
        this.deviceInfo = await parseStringPromise(deviceInfoResponse.data);
        
        // Get device capabilities
        await this.fetchCapabilities();
        
        // Set camera name based on device info
        if (this.deviceInfo?.DeviceInfo?.deviceName?.[0]) {
          this.metadata.name = this.deviceInfo.DeviceInfo.deviceName[0];
        }
        
        // Set camera model
        if (this.deviceInfo?.DeviceInfo?.model?.[0]) {
          this.metadata.model = this.deviceInfo.DeviceInfo.model[0];
        }
        
        // Set camera firmware version
        if (this.deviceInfo?.DeviceInfo?.firmwareVersion?.[0]) {
          this.metadata.firmwareVersion = this.deviceInfo.DeviceInfo.firmwareVersion[0];
        }
        
        // Get session ID if available
        if (deviceInfoResponse.headers['set-cookie']) {
          const sessionIdMatch = deviceInfoResponse.headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/);
          if (sessionIdMatch) {
            this.sessionId = sessionIdMatch[1];
          }
        }
        
        this.logger.info(`Connected to Hikvision camera: ${this.metadata.name}`, { 
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
      this.logger.error('Error connecting to Hikvision camera', { 
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
    this.sessionId = null;
    this.logger.info(`Disconnected from Hikvision camera: ${this.metadata.name}`, { 
      cameraId: this.metadata.id 
    });
  }

  /**
   * Get list of available streams from the camera
   */
  async getAvailableStreams(): Promise<StreamSettings[]> {
    try {
      const response = await this.axiosInstance.get('/ISAPI/Streaming/channels');
      const result = await parseStringPromise(response.data);
      
      const streams: StreamSettings[] = [];
      
      if (result?.StreamingChannelList?.StreamingChannel) {
        const channels = result.StreamingChannelList.StreamingChannel;
        
        for (const channel of channels) {
          const id = channel.id?.[0];
          const enabled = channel.enabled?.[0] === 'true';
          
          if (id && enabled) {
            streams.push({
              id: `hikvision-stream-${id}`,
              name: `Channel ${id}`,
              url: `/ISAPI/Streaming/channels/${id}`,
              type: 'rtsp',
              resolution: {
                width: parseInt(channel?.Video?.[0]?.videoResolutionWidth?.[0] || '0', 10),
                height: parseInt(channel?.Video?.[0]?.videoResolutionHeight?.[0] || '0', 10)
              },
              format: channel?.Video?.[0]?.videoCodecType?.[0] || 'H.264',
              rtspUrl: `rtsp://${this.metadata.host}:554/ISAPI/Streaming/channels/${id}`
            });
          }
        }
      }
      
      return streams;
    } catch (error) {
      this.logger.error('Error getting streams from Hikvision camera', { 
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
      const response = await this.axiosInstance.get('/ISAPI/System/capabilities');
      const result = await parseStringPromise(response.data);
      
      // Check for PTZ capability
      if (result?.SystemCapability?.PTZCapability?.[0]?.support?.[0] === 'true') {
        this.capabilities.ptz = true;
        this.capabilities.presets = true;
      }
      
      // Check for audio capability
      if (result?.SystemCapability?.AudioOutputCapability?.[0]?.support?.[0] === 'true') {
        this.capabilities.audio = true;
      }
      
      // Check for event capability
      if (result?.SystemCapability?.EventCapability?.[0]?.support?.[0] === 'true') {
        this.capabilities.events = true;
      }
      
      // Check for motion detection
      if (result?.SystemCapability?.SupportMotionDetection?.[0] === 'true') {
        this.capabilities.motionDetection = true;
      }
      
      // Check for privacy mask
      if (result?.SystemCapability?.PrivacyMaskCapability?.[0]?.support?.[0] === 'true') {
        this.capabilities.privacyMask = true;
      }
      
      // Check for wide dynamic range
      if (result?.SystemCapability?.WDRCapability?.[0]?.support?.[0] === 'true') {
        this.capabilities.wdr = true;
      }
    } catch (error) {
      this.logger.error('Error fetching camera capabilities', { 
        cameraId: this.metadata.id, 
        error 
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
      
      // Get the stream to know resolution
      const streams = await this.getAvailableStreams();
      const stream = streams.find(s => (streamId ? s.id === streamId : true));
      
      return {
        data: buffer,
        timestamp: Date.now(),
        width: stream?.resolution.width || 640,
        height: stream?.resolution.height || 480,
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
   * Execute PTZ command
   */
  async executePTZCommand(command: PTZCommand): Promise<boolean> {
    if (!this.capabilities.ptz) {
      this.logger.warn('Camera does not support PTZ', { cameraId: this.metadata.id });
      return false;
    }
    
    try {
      // Determine channel (default to 1)
      const channel = command.channel || '1';
      
      let ptzXml = '';
      
      // Generate appropriate XML for different PTZ commands
      switch (command.action) {
        case 'move':
          ptzXml = `
            <PTZData>
              <pan>${command.params?.pan || 0}</pan>
              <tilt>${command.params?.tilt || 0}</tilt>
              <zoom>${command.params?.zoom || 0}</zoom>
            </PTZData>
          `;
          break;
          
        case 'preset':
          if (command.params?.preset) {
            ptzXml = `
              <PTZPreset>
                <id>${command.params.preset}</id>
              </PTZPreset>
            `;
          }
          break;
          
        case 'stop':
          ptzXml = `
            <PTZData>
              <pan>0</pan>
              <tilt>0</tilt>
              <zoom>0</zoom>
            </PTZData>
          `;
          break;
          
        default:
          throw new Error(`Unsupported PTZ action: ${command.action}`);
      }
      
      // Send PTZ command
      const endpoint = command.action === 'preset' 
        ? `/ISAPI/PTZCtrl/channels/${channel}/presets/${command.params?.preset}/goto` 
        : `/ISAPI/PTZCtrl/channels/${channel}/continuous`;
      
      const response = await this.axiosInstance.put(endpoint, ptzXml);
      
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
   * Subscribe to camera events
   */
  async subscribeToEvents(): Promise<boolean> {
    if (!this.capabilities.includes(CameraCapability.EVENTS)) {
      this.logger.warn('Camera does not support events', { cameraId: this.metadata.id });
      return false;
    }
    
    try {
      // Create event subscription
      const eventSubscriptionXml = `
        <EventNotificationAlert>
          <ipAddress>${process.env.EVENT_RECEIVER_IP || 'localhost'}</ipAddress>
          <portNo>${process.env.EVENT_RECEIVER_PORT || 8080}</portNo>
          <protocol>HTTP</protocol>
          <httpAuthenticationMethod>basic</httpAuthenticationMethod>
          <userName>${process.env.EVENT_RECEIVER_USERNAME || 'admin'}</userName>
          <password>${process.env.EVENT_RECEIVER_PASSWORD || 'admin'}</password>
          <eventType>all</eventType>
        </EventNotificationAlert>
      `;
      
      const response = await this.axiosInstance.post('/ISAPI/Event/notification/alertStream', eventSubscriptionXml);
      
      return response.status === 200;
    } catch (error) {
      this.logger.error('Error subscribing to events', { 
        cameraId: this.metadata.id, 
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
      const channel = streamId?.split('-').pop() || '1';
      const response = await this.axiosInstance.get(`/ISAPI/Streaming/channels/${channel}/picture`, {
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
}