import { 
  ICameraProtocol, 
  CameraConfig, 
  StreamOptions, 
  ConnectionStatus,
  PtzMovement,
  CameraEvent
} from './interfaces/ICameraProtocol';
import { protocolRegistry } from './CameraProtocolRegistry';

/**
 * Camera instance information
 */
export interface CameraInstance {
  /**
   * Unique camera identifier
   */
  id: string;
  
  /**
   * Camera name
   */
  name: string;
  
  /**
   * Camera configuration
   */
  config: CameraConfig;
  
  /**
   * Protocol used for this camera
   */
  protocol: ICameraProtocol;
  
  /**
   * Connection status
   */
  status: ConnectionStatus;
  
  /**
   * Active stream IDs
   */
  activeStreams: string[];
  
  /**
   * Camera metadata
   */
  metadata: Record<string, any>;
}

/**
 * Camera creation options
 */
export interface CameraCreationOptions {
  /**
   * Camera identifier (generated if not provided)
   */
  id?: string;
  
  /**
   * Camera name
   */
  name: string;
  
  /**
   * Camera configuration
   */
  config: CameraConfig;
  
  /**
   * Preferred protocol ID
   */
  preferredProtocol?: string;
  
  /**
   * Connect immediately
   */
  connectImmediately?: boolean;
  
  /**
   * Camera metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Camera event handler information
 */
interface CameraEventHandlerInfo {
  /**
   * Camera ID
   */
  cameraId: string;
  
  /**
   * Handler ID from protocol
   */
  handlerId: string;
  
  /**
   * Event types
   */
  eventTypes?: string[];
  
  /**
   * Event handler function
   */
  handler: (event: CameraEvent) => void;
}

/**
 * CameraManager class
 * 
 * Centralized management of all cameras with protocol abstraction
 */
export class CameraManager {
  private static instance: CameraManager;
  
  /**
   * Active camera instances
   */
  private cameras: Map<string, CameraInstance> = new Map();
  
  /**
   * Event handler registry
   */
  private eventHandlers: Map<string, CameraEventHandlerInfo> = new Map();
  
  /**
   * Private constructor (singleton pattern)
   */
  private constructor() { }
  
  /**
   * Get manager instance
   */
  public static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    
    return CameraManager.instance;
  }
  
  /**
   * Add a camera
   * 
   * @param options Camera creation options
   */
  public async addCamera(options: CameraCreationOptions): Promise<CameraInstance> {
    // Generate ID if not provided
    const cameraId = options.id || `camera-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Check if camera already exists
    if (this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' already exists`);
    }
    
    // Detect and connect to camera
    const protocol = await protocolRegistry.detectProtocol(
      options.config,
      options.preferredProtocol
    );
    
    // Create camera instance
    const camera: CameraInstance = {
      id: cameraId,
      name: options.name,
      config: options.config,
      protocol,
      status: ConnectionStatus.DISCONNECTED,
      activeStreams: [],
      metadata: options.metadata || {}
    };
    
    // Connect immediately if requested
    if (options.connectImmediately) {
      await this.connectCamera(cameraId, protocol);
    }
    
    // Store camera instance
    this.cameras.set(cameraId, camera);
    
    return camera;
  }
  
  /**
   * Remove a camera
   * 
   * @param cameraId Camera identifier
   */
  public async removeCamera(cameraId: string): Promise<void> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Disconnect camera if connected
    if (camera.status === ConnectionStatus.CONNECTED) {
      await camera.protocol.disconnect();
    }
    
    // Remove event handlers for this camera
    for (const [handlerId, info] of this.eventHandlers.entries()) {
      if (info.cameraId === cameraId) {
        camera.protocol.removeEventHandler(info.handlerId);
        this.eventHandlers.delete(handlerId);
      }
    }
    
    // Remove camera instance
    this.cameras.delete(cameraId);
  }
  
  /**
   * Get all cameras
   */
  public getAllCameras(): CameraInstance[] {
    return Array.from(this.cameras.values());
  }
  
  /**
   * Get camera by ID
   * 
   * @param cameraId Camera identifier
   */
  public getCamera(cameraId: string): CameraInstance | undefined {
    return this.cameras.get(cameraId);
  }
  
  /**
   * Connect to a camera
   * 
   * @param cameraId Camera identifier
   * @param protocol Optional protocol to use
   */
  public async connectCamera(
    cameraId: string,
    protocol?: ICameraProtocol
  ): Promise<boolean> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Use provided protocol or current protocol
    const cameraProtocol = protocol || camera.protocol;
    
    try {
      // Connect to camera
      const connected = await cameraProtocol.connect(camera.config);
      
      if (connected) {
        // Update camera instance
        camera.protocol = cameraProtocol;
        camera.status = ConnectionStatus.CONNECTED;
        
        // Update camera in registry
        this.cameras.set(cameraId, camera);
        
        return true;
      }
      
      return false;
    } catch (error) {
      // Update status on error
      camera.status = ConnectionStatus.ERROR;
      this.cameras.set(cameraId, camera);
      
      throw error;
    }
  }
  
  /**
   * Disconnect from a camera
   * 
   * @param cameraId Camera identifier
   */
  public async disconnectCamera(cameraId: string): Promise<void> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Disconnect only if connected
    if (camera.status === ConnectionStatus.CONNECTED) {
      await camera.protocol.disconnect();
      
      // Update camera instance
      camera.status = ConnectionStatus.DISCONNECTED;
      camera.activeStreams = [];
      
      // Update camera in registry
      this.cameras.set(cameraId, camera);
    }
  }
  
  /**
   * Start streaming from a camera
   * 
   * @param cameraId Camera identifier
   * @param options Stream options
   */
  public async startStream(
    cameraId: string,
    options?: StreamOptions
  ): Promise<string> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Check if camera is connected
    if (camera.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`Camera '${cameraId}' is not connected`);
    }
    
    // Start stream
    const streamId = await camera.protocol.startStream(options);
    
    // Update camera instance
    camera.activeStreams.push(streamId);
    this.cameras.set(cameraId, camera);
    
    return streamId;
  }
  
  /**
   * Stop streaming from a camera
   * 
   * @param cameraId Camera identifier
   * @param streamId Stream identifier (optional)
   */
  public async stopStream(cameraId: string, streamId?: string): Promise<void> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Check if camera is connected
    if (camera.status !== ConnectionStatus.CONNECTED) {
      return;
    }
    
    // Stop stream
    await camera.protocol.stopStream(streamId);
    
    // Update camera instance
    if (streamId) {
      camera.activeStreams = camera.activeStreams.filter(id => id !== streamId);
    } else {
      camera.activeStreams = [];
    }
    
    this.cameras.set(cameraId, camera);
  }
  
  /**
   * Get a frame from a camera
   * 
   * @param cameraId Camera identifier
   */
  public async getFrame(cameraId: string): Promise<Uint8Array> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Check if camera is connected
    if (camera.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`Camera '${cameraId}' is not connected`);
    }
    
    // Get frame
    return await camera.protocol.getFrame();
  }
  
  /**
   * Move a camera
   * 
   * @param cameraId Camera identifier
   * @param movement Movement parameters
   */
  public async moveCamera(cameraId: string, movement: PtzMovement): Promise<void> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Check if camera is connected
    if (camera.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`Camera '${cameraId}' is not connected`);
    }
    
    // Check if camera supports PTZ
    if (!camera.protocol.capabilities.ptz) {
      throw new Error(`Camera '${cameraId}' does not support PTZ controls`);
    }
    
    // Move camera
    await camera.protocol.move(movement);
  }
  
  /**
   * Go to a preset position
   * 
   * @param cameraId Camera identifier
   * @param presetId Preset identifier
   */
  public async gotoPreset(cameraId: string, presetId: string): Promise<void> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Check if camera is connected
    if (camera.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`Camera '${cameraId}' is not connected`);
    }
    
    // Check if camera supports presets
    if (!camera.protocol.capabilities.presets) {
      throw new Error(`Camera '${cameraId}' does not support PTZ presets`);
    }
    
    // Go to preset
    await camera.protocol.gotoPreset(presetId);
  }
  
  /**
   * Save current position as preset
   * 
   * @param cameraId Camera identifier
   * @param presetName Preset name
   */
  public async savePreset(cameraId: string, presetName: string): Promise<string> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Check if camera is connected
    if (camera.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`Camera '${cameraId}' is not connected`);
    }
    
    // Check if camera supports presets
    if (!camera.protocol.capabilities.presets) {
      throw new Error(`Camera '${cameraId}' does not support PTZ presets`);
    }
    
    // Save preset
    return await camera.protocol.savePreset(presetName);
  }
  
  /**
   * Register camera event handler
   * 
   * @param cameraId Camera identifier
   * @param eventTypes Event types to handle
   * @param handler Event handler function
   */
  public async onCameraEvent(
    cameraId: string,
    eventTypes: string[],
    handler: (event: CameraEvent) => void
  ): Promise<string> {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Check if camera is connected
    if (camera.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`Camera '${cameraId}' is not connected`);
    }
    
    // Check if camera supports events
    if (!camera.protocol.capabilities.events) {
      throw new Error(`Camera '${cameraId}' does not support events`);
    }
    
    // Subscribe to events
    const subscriptionId = await camera.protocol.subscribeToEvents(eventTypes);
    
    // Create handler wrapper
    const handlerWrapper = (event: CameraEvent) => {
      // Only call handler for subscribed event types
      if (eventTypes.includes(event.type)) {
        handler(event);
      }
    };
    
    // Register handler
    const handlerId = camera.protocol.onEvent(handlerWrapper);
    
    // Generate global handler ID
    const globalHandlerId = `handler-${cameraId}-${handlerId}`;
    
    // Store handler info
    this.eventHandlers.set(globalHandlerId, {
      cameraId,
      handlerId,
      eventTypes,
      handler
    });
    
    return globalHandlerId;
  }
  
  /**
   * Remove camera event handler
   * 
   * @param handlerId Global handler identifier
   */
  public removeEventHandler(handlerId: string): void {
    // Check if handler exists
    if (!this.eventHandlers.has(handlerId)) {
      return;
    }
    
    const handlerInfo = this.eventHandlers.get(handlerId)!;
    
    // Check if camera exists
    if (!this.cameras.has(handlerInfo.cameraId)) {
      this.eventHandlers.delete(handlerId);
      return;
    }
    
    const camera = this.cameras.get(handlerInfo.cameraId)!;
    
    // Remove handler
    camera.protocol.removeEventHandler(handlerInfo.handlerId);
    
    // Remove handler info
    this.eventHandlers.delete(handlerId);
  }
  
  /**
   * Update camera metadata
   * 
   * @param cameraId Camera identifier
   * @param metadata Metadata object
   */
  public updateCameraMetadata(
    cameraId: string,
    metadata: Record<string, any>
  ): void {
    // Check if camera exists
    if (!this.cameras.has(cameraId)) {
      throw new Error(`Camera with ID '${cameraId}' not found`);
    }
    
    const camera = this.cameras.get(cameraId)!;
    
    // Update metadata
    camera.metadata = {
      ...camera.metadata,
      ...metadata
    };
    
    // Update camera in registry
    this.cameras.set(cameraId, camera);
  }
  
  /**
   * Reconnect all cameras
   */
  public async reconnectAllCameras(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const camera of this.cameras.values()) {
      try {
        // Only attempt to reconnect disconnected or error cameras
        if (camera.status === ConnectionStatus.DISCONNECTED || 
            camera.status === ConnectionStatus.ERROR) {
          results[camera.id] = await this.connectCamera(camera.id);
        } else {
          results[camera.id] = true; // Already connected
        }
      } catch (error) {
        results[camera.id] = false;
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const cameraManager = CameraManager.getInstance();