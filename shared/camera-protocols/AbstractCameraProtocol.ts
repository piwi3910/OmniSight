import { 
  ICameraProtocol,
  CameraConfig,
  StreamOptions,
  ConnectionStatus,
  PtzMovement,
  CameraInfo,
  StreamProfile,
  CameraEvent,
  CameraCapabilities
} from './interfaces/ICameraProtocol';

/**
 * Abstract base class for camera protocol implementations
 * 
 * This class implements common functionality shared by all camera protocols
 * and provides a foundation for concrete protocol implementations.
 */
export abstract class AbstractCameraProtocol implements ICameraProtocol {
  /**
   * Protocol identifier
   */
  abstract readonly protocolId: string;
  
  /**
   * Protocol name
   */
  abstract readonly protocolName: string;
  
  /**
   * Protocol capabilities
   */
  abstract readonly capabilities: CameraCapabilities;
  
  /**
   * Camera configuration
   */
  protected config: CameraConfig | null = null;
  
  /**
   * Current connection status
   */
  protected connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  
  /**
   * Active streams
   */
  protected activeStreams: Map<string, any> = new Map();
  
  /**
   * Event handlers
   */
  protected eventHandlers: Map<string, (event: CameraEvent) => void> = new Map();
  
  /**
   * Event subscriptions
   */
  protected eventSubscriptions: Map<string, string[]> = new Map();
  
  /**
   * Connect to the camera
   * 
   * @param config Camera configuration
   */
  async connect(config: CameraConfig): Promise<boolean> {
    this.config = config;
    this.connectionStatus = ConnectionStatus.CONNECTING;
    
    try {
      const connected = await this.performConnect(config);
      this.connectionStatus = connected ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR;
      return connected;
    } catch (error) {
      this.connectionStatus = ConnectionStatus.ERROR;
      throw error;
    }
  }
  
  /**
   * Disconnect from the camera
   */
  async disconnect(): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      return;
    }
    
    try {
      // Stop all active streams
      for (const streamId of this.activeStreams.keys()) {
        await this.stopStream(streamId);
      }
      
      // Unsubscribe from all events
      for (const subscriptionId of this.eventSubscriptions.keys()) {
        await this.unsubscribeFromEvents(subscriptionId);
      }
      
      await this.performDisconnect();
      this.connectionStatus = ConnectionStatus.DISCONNECTED;
    } catch (error) {
      this.connectionStatus = ConnectionStatus.ERROR;
      throw error;
    }
  }
  
  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
  
  /**
   * Start camera stream
   * 
   * @param options Stream options
   */
  async startStream(options?: StreamOptions): Promise<string> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error(`Cannot start stream: Camera is not connected (status: ${this.connectionStatus})`);
    }
    
    const streamId = await this.performStartStream(options);
    return streamId;
  }
  
  /**
   * Stop camera stream
   * 
   * @param streamId Stream identifier
   */
  async stopStream(streamId?: string): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      return;
    }
    
    if (streamId) {
      if (this.activeStreams.has(streamId)) {
        await this.performStopStream(streamId);
        this.activeStreams.delete(streamId);
      }
    } else {
      // Stop all streams if no streamId provided
      for (const id of this.activeStreams.keys()) {
        await this.performStopStream(id);
      }
      this.activeStreams.clear();
    }
  }
  
  /**
   * Get a single frame from camera
   */
  abstract getFrame(): Promise<Uint8Array>;
  
  /**
   * Move camera using PTZ controls
   * 
   * @param movement Movement parameters
   */
  async move(movement: PtzMovement): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error(`Cannot move camera: Camera is not connected (status: ${this.connectionStatus})`);
    }
    
    if (!this.capabilities.ptz) {
      throw new Error('This camera does not support PTZ controls');
    }
    
    await this.performMove(movement);
  }
  
  /**
   * Go to a preset position
   * 
   * @param presetId Preset identifier
   */
  async gotoPreset(presetId: string): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error(`Cannot go to preset: Camera is not connected (status: ${this.connectionStatus})`);
    }
    
    if (!this.capabilities.presets) {
      throw new Error('This camera does not support PTZ presets');
    }
    
    await this.performGotoPreset(presetId);
  }
  
  /**
   * Save current position as preset
   * 
   * @param presetName Preset name
   */
  async savePreset(presetName: string): Promise<string> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error(`Cannot save preset: Camera is not connected (status: ${this.connectionStatus})`);
    }
    
    if (!this.capabilities.presets) {
      throw new Error('This camera does not support PTZ presets');
    }
    
    return await this.performSavePreset(presetName);
  }
  
  /**
   * Get camera information
   */
  abstract getCameraInfo(): Promise<CameraInfo>;
  
  /**
   * Get available stream profiles
   */
  abstract getAvailableStreams(): Promise<StreamProfile[]>;
  
  /**
   * Get protocol-specific options
   */
  abstract getProtocolOptions(): Record<string, any>;
  
  /**
   * Set protocol-specific options
   * 
   * @param options Protocol options
   */
  abstract setProtocolOptions(options: Record<string, any>): Promise<void>;
  
  /**
   * Test connection to camera
   * 
   * @param config Camera configuration
   */
  async testConnection(config: CameraConfig): Promise<boolean> {
    try {
      return await this.performTestConnection(config);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Subscribe to camera events
   * 
   * @param eventTypes Event types to subscribe to
   */
  async subscribeToEvents(eventTypes: string[]): Promise<string> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error(`Cannot subscribe to events: Camera is not connected (status: ${this.connectionStatus})`);
    }
    
    if (!this.capabilities.events) {
      throw new Error('This camera does not support event subscription');
    }
    
    const subscriptionId = await this.performSubscribeToEvents(eventTypes);
    this.eventSubscriptions.set(subscriptionId, eventTypes);
    return subscriptionId;
  }
  
  /**
   * Unsubscribe from camera events
   * 
   * @param subscriptionId Subscription identifier
   */
  async unsubscribeFromEvents(subscriptionId: string): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      return;
    }
    
    if (!this.capabilities.events) {
      return;
    }
    
    if (this.eventSubscriptions.has(subscriptionId)) {
      await this.performUnsubscribeFromEvents(subscriptionId);
      this.eventSubscriptions.delete(subscriptionId);
    }
  }
  
  /**
   * Register event handler
   * 
   * @param handler Event handler function
   */
  onEvent(handler: (event: CameraEvent) => void): string {
    const handlerId = `handler-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.eventHandlers.set(handlerId, handler);
    return handlerId;
  }
  
  /**
   * Remove event handler
   * 
   * @param handlerId Handler identifier
   */
  removeEventHandler(handlerId: string): void {
    this.eventHandlers.delete(handlerId);
  }
  
  /**
   * Dispatch event to all handlers
   * 
   * @param event Camera event
   */
  protected dispatchEvent(event: CameraEvent): void {
    for (const handler of this.eventHandlers.values()) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    }
  }
  
  // Abstract methods to be implemented by concrete protocol classes
  
  /**
   * Perform protocol-specific connection
   * 
   * @param config Camera configuration
   */
  protected abstract performConnect(config: CameraConfig): Promise<boolean>;
  
  /**
   * Perform protocol-specific disconnection
   */
  protected abstract performDisconnect(): Promise<void>;
  
  /**
   * Perform protocol-specific stream start
   * 
   * @param options Stream options
   */
  protected abstract performStartStream(options?: StreamOptions): Promise<string>;
  
  /**
   * Perform protocol-specific stream stop
   * 
   * @param streamId Stream identifier
   */
  protected abstract performStopStream(streamId: string): Promise<void>;
  
  /**
   * Perform protocol-specific camera movement
   * 
   * @param movement Movement parameters
   */
  protected abstract performMove(movement: PtzMovement): Promise<void>;
  
  /**
   * Perform protocol-specific preset recall
   * 
   * @param presetId Preset identifier
   */
  protected abstract performGotoPreset(presetId: string): Promise<void>;
  
  /**
   * Perform protocol-specific preset save
   * 
   * @param presetName Preset name
   */
  protected abstract performSavePreset(presetName: string): Promise<string>;
  
  /**
   * Perform protocol-specific connection test
   * 
   * @param config Camera configuration
   */
  protected abstract performTestConnection(config: CameraConfig): Promise<boolean>;
  
  /**
   * Perform protocol-specific event subscription
   * 
   * @param eventTypes Event types to subscribe to
   */
  protected abstract performSubscribeToEvents(eventTypes: string[]): Promise<string>;
  
  /**
   * Perform protocol-specific event unsubscription
   * 
   * @param subscriptionId Subscription identifier
   */
  protected abstract performUnsubscribeFromEvents(subscriptionId: string): Promise<void>;
}