import { ICameraProtocol, CameraConfig, ConnectionStatus } from './interfaces/ICameraProtocol';

/**
 * Protocol detection result
 */
interface ProtocolDetectionResult {
  /**
   * Protocol that was detected
   */
  protocol: ICameraProtocol;
  
  /**
   * Confidence level (0.0 to 1.0)
   */
  confidence: number;
  
  /**
   * Detection time in milliseconds
   */
  detectionTime: number;
}

/**
 * Protocol registry options
 */
interface ProtocolRegistryOptions {
  /**
   * Enable automatic protocol detection
   */
  enableAutoDetection?: boolean;
  
  /**
   * Enable protocol fallback
   */
  enableFallback?: boolean;
  
  /**
   * Default protocol to use when auto-detection fails
   */
  defaultProtocol?: string;
  
  /**
   * Protocol priority order for auto-detection and fallback
   */
  protocolPriority?: string[];
  
  /**
   * Detection timeout in milliseconds
   */
  detectionTimeout?: number;
}

/**
 * CameraProtocolRegistry
 * 
 * Central registry for camera protocols that handles protocol
 * registration, detection, selection, and fallback mechanisms.
 */
export class CameraProtocolRegistry {
  private static instance: CameraProtocolRegistry;
  
  /**
   * Map of registered protocols
   */
  private protocols: Map<string, ICameraProtocol> = new Map();
  
  /**
   * Protocol registry options
   */
  private options: ProtocolRegistryOptions = {
    enableAutoDetection: true,
    enableFallback: true,
    defaultProtocol: 'rtsp', // Default to RTSP
    protocolPriority: ['rtsp', 'onvif', 'mjpeg', 'webrtc', 'hls'],
    detectionTimeout: 5000 // 5 seconds
  };
  
  /**
   * Private constructor (singleton pattern)
   */
  private constructor() { }
  
  /**
   * Get registry instance
   */
  public static getInstance(): CameraProtocolRegistry {
    if (!CameraProtocolRegistry.instance) {
      CameraProtocolRegistry.instance = new CameraProtocolRegistry();
    }
    
    return CameraProtocolRegistry.instance;
  }
  
  /**
   * Configure the protocol registry
   * 
   * @param options Protocol registry options
   */
  public configure(options: Partial<ProtocolRegistryOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Register a camera protocol
   * 
   * @param protocol Protocol implementation
   */
  public registerProtocol(protocol: ICameraProtocol): void {
    if (this.protocols.has(protocol.protocolId)) {
      throw new Error(`Protocol with ID '${protocol.protocolId}' is already registered`);
    }
    
    this.protocols.set(protocol.protocolId, protocol);
  }
  
  /**
   * Unregister a camera protocol
   * 
   * @param protocolId Protocol identifier
   */
  public unregisterProtocol(protocolId: string): void {
    this.protocols.delete(protocolId);
  }
  
  /**
   * Get a protocol by ID
   * 
   * @param protocolId Protocol identifier
   */
  public getProtocol(protocolId: string): ICameraProtocol | undefined {
    return this.protocols.get(protocolId);
  }
  
  /**
   * Get all registered protocols
   */
  public getAllProtocols(): ICameraProtocol[] {
    return Array.from(this.protocols.values());
  }
  
  /**
   * Get protocols that support a specific capability
   * 
   * @param capability Capability name
   */
  public getProtocolsWithCapability(capability: keyof ICameraProtocol['capabilities']): ICameraProtocol[] {
    return this.getAllProtocols().filter(protocol => 
      protocol.capabilities[capability] === true
    );
  }
  
  /**
   * Detect the best protocol for a camera
   * 
   * @param config Camera configuration
   * @param preferredProtocol Preferred protocol ID (optional)
   */
  public async detectProtocol(
    config: CameraConfig,
    preferredProtocol?: string
  ): Promise<ICameraProtocol> {
    // If preferred protocol is specified and exists, try it first
    if (preferredProtocol && this.protocols.has(preferredProtocol)) {
      const protocol = this.protocols.get(preferredProtocol)!;
      const isAccessible = await protocol.testConnection(config);
      
      if (isAccessible) {
        return protocol;
      }
      
      // If preferred protocol failed and fallback is disabled, throw error
      if (!this.options.enableFallback) {
        throw new Error(`Preferred protocol '${preferredProtocol}' failed and fallback is disabled`);
      }
    }
    
    // If auto-detection is enabled, try to detect the protocol
    if (this.options.enableAutoDetection) {
      try {
        const detectionResult = await this.performProtocolDetection(config);
        return detectionResult.protocol;
      } catch (error: any) {
        // If auto-detection failed and fallback is disabled, throw error
        if (!this.options.enableFallback) {
          throw new Error(`Protocol auto-detection failed and fallback is disabled: ${error?.message || 'Unknown error'}`);
        }
      }
    }
    
    // Fall back to default protocol if specified
    if (this.options.defaultProtocol && this.protocols.has(this.options.defaultProtocol)) {
      return this.protocols.get(this.options.defaultProtocol)!;
    }
    
    // If everything failed, throw error
    throw new Error('No suitable protocol found for camera');
  }
  
  /**
   * Connect to a camera using the best available protocol
   * 
   * @param config Camera configuration
   * @param preferredProtocol Preferred protocol ID (optional)
   */
  public async connectCamera(
    config: CameraConfig,
    preferredProtocol?: string
  ): Promise<ICameraProtocol> {
    const protocol = await this.detectProtocol(config, preferredProtocol);
    
    try {
      const connected = await protocol.connect(config);
      
      if (!connected) {
        throw new Error(`Failed to connect using protocol '${protocol.protocolId}'`);
      }
      
      return protocol;
    } catch (error) {
      // If connection failed and fallback is enabled, try other protocols
      if (this.options.enableFallback) {
        return this.fallbackConnect(config, protocol.protocolId);
      }
      
      throw error;
    }
  }
  
  /**
   * Fallback to other protocols if primary protocol fails
   * 
   * @param config Camera configuration
   * @param excludeProtocolId Protocol ID to exclude from fallback
   */
  private async fallbackConnect(
    config: CameraConfig,
    excludeProtocolId: string
  ): Promise<ICameraProtocol> {
    // Get all protocols except the excluded one
    const fallbackProtocols = this.getAllProtocols()
      .filter(p => p.protocolId !== excludeProtocolId);
    
    // Sort protocols by priority
    if (this.options.protocolPriority && this.options.protocolPriority.length > 0) {
      fallbackProtocols.sort((a, b) => {
        const priorityA = this.options.protocolPriority!.indexOf(a.protocolId);
        const priorityB = this.options.protocolPriority!.indexOf(b.protocolId);
        
        // If protocol is not in priority list, put it at the end
        if (priorityA === -1) return 1;
        if (priorityB === -1) return -1;
        
        return priorityA - priorityB;
      });
    }
    
    // Try each protocol in order
    for (const protocol of fallbackProtocols) {
      try {
        const connected = await protocol.connect(config);
        
        if (connected) {
          return protocol;
        }
      } catch (error: any) {
        // Ignore errors and try next protocol
        console.warn(`Fallback protocol '${protocol.protocolId}' failed: ${error?.message || 'Unknown error'}`);
      }
    }
    
    throw new Error('All fallback protocols failed');
  }
  
  /**
   * Perform protocol detection
   * 
   * @param config Camera configuration
   */
  private async performProtocolDetection(
    config: CameraConfig
  ): Promise<ProtocolDetectionResult> {
    // All registered protocols
    const protocols = this.getAllProtocols();
    
    // If priority is specified, sort protocols by priority
    if (this.options.protocolPriority && this.options.protocolPriority.length > 0) {
      protocols.sort((a, b) => {
        const priorityA = this.options.protocolPriority!.indexOf(a.protocolId);
        const priorityB = this.options.protocolPriority!.indexOf(b.protocolId);
        
        // If protocol is not in priority list, put it at the end
        if (priorityA === -1) return 1;
        if (priorityB === -1) return -1;
        
        return priorityA - priorityB;
      });
    }
    
    // Detection results
    const results: ProtocolDetectionResult[] = [];
    
    // Test protocols in parallel with timeout
    const testPromises = protocols.map(async protocol => {
      const startTime = Date.now();
      
      try {
        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Protocol detection timed out for '${protocol.protocolId}'`));
          }, this.options.detectionTimeout);
        });
        
        // Race between connection test and timeout
        const isAccessible = await Promise.race([
          protocol.testConnection(config),
          timeoutPromise
        ]);
        
        const detectionTime = Date.now() - startTime;
        
        if (isAccessible) {
          results.push({
            protocol,
            confidence: 1.0, // Full confidence if connection test succeeds
            detectionTime
          });
        }
      } catch (error) {
        // Ignore errors during detection
      }
    });
    
    // Wait for all tests to complete
    await Promise.all(testPromises);
    
    // If no protocols were detected, throw error
    if (results.length === 0) {
      throw new Error('No protocols detected for camera');
    }
    
    // Sort results by confidence and detection time
    results.sort((a, b) => {
      // First by confidence (descending)
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      
      // Then by detection time (ascending)
      return a.detectionTime - b.detectionTime;
    });
    
    // Return the best match
    return results[0];
  }
}

// Export singleton instance
export const protocolRegistry = CameraProtocolRegistry.getInstance();