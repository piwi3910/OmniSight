/**
 * Hardware Acceleration Abstraction Layer
 *
 * This module provides a unified interface for hardware acceleration across different platforms,
 * including NVIDIA, AMD, Intel GPUs, and various NPU/TPU accelerators.
 */

/**
 * Supported hardware acceleration platforms
 */
export enum AccelerationPlatform {
  CPU = 'cpu', // Software fallback (no hardware acceleration)
  NVIDIA_CUDA = 'nvidia_cuda', // NVIDIA CUDA (General purpose)
  NVIDIA_NVENC = 'nvidia_nvenc', // NVIDIA NVENC (Encoding)
  NVIDIA_NVDEC = 'nvidia_nvdec', // NVIDIA NVDEC (Decoding)
  NVIDIA_TENSORRT = 'nvidia_tensorrt', // NVIDIA TensorRT (Inference)
  AMD_ROCM = 'amd_rocm', // AMD ROCm (General purpose)
  AMD_AMF = 'amd_amf', // AMD AMF (Encoding/Decoding)
  AMD_MIGRAPHX = 'amd_migraphx', // AMD MIGraphX (Inference)
  INTEL_QSV = 'intel_qsv', // Intel Quick Sync Video (Encoding/Decoding)
  INTEL_ONEAPI = 'intel_oneapi', // Intel oneAPI (General purpose)
  INTEL_OPENVINO = 'intel_openvino', // Intel OpenVINO (Inference)
  GOOGLE_TPU = 'google_tpu', // Google Edge TPU (Inference)
  ROCKCHIP_NPU = 'rockchip_npu', // Rockchip NPU (Inference)
  ARM_MALI = 'arm_mali', // ARM Mali GPU (General purpose)
  QUALCOMM_DSP = 'qualcomm_dsp', // Qualcomm Hexagon DSP (Inference)
  WEBNN = 'webnn', // WebNN (Browser-based acceleration)
}

/**
 * Acceleration task types
 */
export enum AccelerationTaskType {
  VIDEO_DECODING = 'video_decoding', // Video decoding
  VIDEO_ENCODING = 'video_encoding', // Video encoding
  IMAGE_PROCESSING = 'image_processing', // Image processing
  INFERENCE = 'inference', // ML model inference
  VIDEO_SCALING = 'video_scaling', // Video scaling/resizing
  MOTION_DETECTION = 'motion_detection', // Motion detection
}

/**
 * Hardware acceleration capability
 */
export interface AccelerationCapability {
  platform: AccelerationPlatform;
  taskTypes: AccelerationTaskType[];
  memorySize?: number; // Memory size in MB
  computeUnits?: number; // Number of compute units
  performanceScore?: number; // Benchmark score (higher is better)
  powerEfficiency?: number; // Power efficiency score (higher is better)
  version?: string; // Platform-specific version info
  supported: boolean; // Whether this platform is available and supported
  preferenceRank?: number; // Preference rank (lower is better, used for auto-selection)
}

/**
 * Hardware acceleration configuration
 */
export interface AccelerationConfig {
  enabled: boolean; // Whether hardware acceleration is enabled
  preferredPlatform?: AccelerationPlatform; // Preferred platform
  fallbackOrder?: AccelerationPlatform[]; // Fallback order for platforms
  taskSpecificPlatforms?: {
    // Platform overrides for specific tasks
    [key in AccelerationTaskType]?: AccelerationPlatform;
  };
  perfPowerBalance?: number; // Balance between performance and power efficiency (0-1, 0 = power, 1 = performance)
  deviceIndices?: { [key in AccelerationPlatform]?: number }; // Specific device indices for platforms with multiple devices
  customParameters?: { [key: string]: unknown }; // Platform-specific parameters
}

/**
 * Acceleration task request
 */
export interface AccelerationTask<TInput, TOutput> {
  type: AccelerationTaskType;
  input: TInput;
  preferredPlatform?: AccelerationPlatform;
  priority?: number; // 0-10, higher is more important
  timeoutMs?: number; // Maximum time in ms to wait for completion
  callbackProgress?: (progress: number) => void; // Progress callback
}

/**
 * Acceleration task result
 */
export interface AccelerationResult<TOutput> {
  output: TOutput;
  platformUsed: AccelerationPlatform;
  executionTimeMs: number; // Execution time in milliseconds
  memoryUsed?: number; // Memory used in MB
  powerUsed?: number; // Estimated power used in watts
  success: boolean;
  error?: string;
}

/**
 * Acceleration statistics
 */
export interface AccelerationStats {
  platform: AccelerationPlatform;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageExecutionTimeMs: number;
  averageMemoryUsed?: number;
  averagePowerUsed?: number;
  uptime: number; // Time since acceleration was initialized in seconds
  deviceUtilization: number; // 0-1, device utilization
  currentTemperature?: number; // Current temperature in Celsius
  throttling?: boolean; // Whether the device is throttling
}

/**
 * Hardware acceleration provider interface
 */
export interface AccelerationProvider {
  /**
   * Initialize the acceleration provider
   */
  initialize(): Promise<boolean>;

  /**
   * Get provider capabilities
   */
  getCapabilities(): Promise<AccelerationCapability[]>;

  /**
   * Execute an acceleration task
   */
  executeTask<TInput, TOutput>(
    task: AccelerationTask<TInput, TOutput>
  ): Promise<AccelerationResult<TOutput>>;

  /**
   * Get provider statistics
   */
  getStatistics(): Promise<AccelerationStats>;

  /**
   * Clean up resources
   */
  shutdown(): Promise<void>;
}

/**
 * Factory for creating acceleration providers
 */
export class AccelerationProviderFactory {
  private static providers: Map<AccelerationPlatform, () => AccelerationProvider> = new Map();

  /**
   * Register a provider for a platform
   */
  public static registerProvider(
    platform: AccelerationPlatform,
    factory: () => AccelerationProvider
  ): void {
    this.providers.set(platform, factory);
  }

  /**
   * Get a provider for a platform
   */
  public static getProvider(platform: AccelerationPlatform): AccelerationProvider | null {
    const factory = this.providers.get(platform);
    if (!factory) {
      return null;
    }

    return factory();
  }

  /**
   * Get all available providers
   */
  public static getAvailableProviders(): AccelerationPlatform[] {
    return Array.from(this.providers.keys());
  }
}

/**
 * Hardware acceleration manager
 */
export class AccelerationManager {
  private static instance: AccelerationManager;
  private config: AccelerationConfig;
  private providers: Map<AccelerationPlatform, AccelerationProvider> = new Map();
  private capabilities: Map<AccelerationPlatform, AccelerationCapability[]> = new Map();
  private initialized: boolean = false;

  private constructor() {
    // Default configuration
    this.config = {
      enabled: true,
      fallbackOrder: [
        AccelerationPlatform.NVIDIA_CUDA,
        AccelerationPlatform.NVIDIA_TENSORRT,
        AccelerationPlatform.AMD_ROCM,
        AccelerationPlatform.AMD_MIGRAPHX,
        AccelerationPlatform.INTEL_OPENVINO,
        AccelerationPlatform.INTEL_ONEAPI,
        AccelerationPlatform.GOOGLE_TPU,
        AccelerationPlatform.ROCKCHIP_NPU,
        AccelerationPlatform.ARM_MALI,
        AccelerationPlatform.QUALCOMM_DSP,
        AccelerationPlatform.WEBNN,
        AccelerationPlatform.CPU,
      ],
      perfPowerBalance: 0.5,
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AccelerationManager {
    if (!AccelerationManager.instance) {
      AccelerationManager.instance = new AccelerationManager();
    }

    return AccelerationManager.instance;
  }

  /**
   * Initialize the acceleration manager
   * Discovers and initializes all available acceleration providers
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    // Get all available providers from the factory
    const availablePlatforms = AccelerationProviderFactory.getAvailableProviders();

    // Initialize each provider
    for (const platform of availablePlatforms) {
      const provider = AccelerationProviderFactory.getProvider(platform);
      if (provider) {
        try {
          const success = await provider.initialize();
          if (success) {
            this.providers.set(platform, provider);
            const capabilities = await provider.getCapabilities();
            this.capabilities.set(platform, capabilities);
            console.log(`Initialized acceleration provider for ${platform}`);
          } else {
            console.warn(`Failed to initialize acceleration provider for ${platform}`);
          }
        } catch (error) {
          console.error(`Error initializing acceleration provider for ${platform}:`, error);
        }
      }
    }

    this.initialized = true;
    return this.providers.size > 0;
  }

  /**
   * Get all available capabilities across all providers
   */
  public async getAvailableCapabilities(): Promise<
    Map<AccelerationPlatform, AccelerationCapability[]>
  > {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.capabilities;
  }

  /**
   * Set the acceleration configuration
   */
  public setConfig(config: Partial<AccelerationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current acceleration configuration
   */
  public getConfig(): AccelerationConfig {
    return { ...this.config };
  }

  /**
   * Get the best provider for a specific task type
   */
  private async getBestProviderForTask(
    taskType: AccelerationTaskType,
    preferredPlatform?: AccelerationPlatform
  ): Promise<AccelerationProvider | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.config.enabled) {
      return null;
    }

    // Check if there's a task-specific platform override
    const taskSpecificPlatform = this.config.taskSpecificPlatforms?.[taskType];

    // Determine the platform to use in order of preference:
    // 1. Explicitly requested platform for this task
    // 2. Task-specific platform from config
    // 3. Global preferred platform from config
    // 4. Fallback order
    const platformToUse =
      preferredPlatform || taskSpecificPlatform || this.config.preferredPlatform;

    if (platformToUse) {
      const provider = this.providers.get(platformToUse);
      if (provider) {
        const capabilities = this.capabilities.get(platformToUse) || [];
        const hasCapability = capabilities.some(
          cap => cap.taskTypes.includes(taskType) && cap.supported
        );

        if (hasCapability) {
          return provider;
        }
      }
    }

    // If no specific platform is available or capable, try fallback order
    if (this.config.fallbackOrder) {
      for (const platform of this.config.fallbackOrder) {
        const provider = this.providers.get(platform);
        if (provider) {
          const capabilities = this.capabilities.get(platform) || [];
          const hasCapability = capabilities.some(
            cap => cap.taskTypes.includes(taskType) && cap.supported
          );

          if (hasCapability) {
            return provider;
          }
        }
      }
    }

    return null;
  }

  /**
   * Execute a task with the best available provider
   */
  public async executeTask<TInput, TOutput>(
    task: AccelerationTask<TInput, TOutput>
  ): Promise<AccelerationResult<TOutput>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const provider = await this.getBestProviderForTask(task.type, task.preferredPlatform);

    if (!provider) {
      throw new Error(`No suitable acceleration provider found for task type ${task.type}`);
    }

    return provider.executeTask(task);
  }

  /**
   * Get statistics from all providers
   */
  public async getAllStatistics(): Promise<Map<AccelerationPlatform, AccelerationStats>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const stats = new Map<AccelerationPlatform, AccelerationStats>();

    for (const [platform, provider] of this.providers.entries()) {
      try {
        const providerStats = await provider.getStatistics();
        stats.set(platform, providerStats);
      } catch (error) {
        console.error(`Error getting statistics for ${platform}:`, error);
      }
    }

    return stats;
  }

  /**
   * Shut down all providers and release resources
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    for (const [platform, provider] of this.providers.entries()) {
      try {
        await provider.shutdown();
        console.log(`Shut down acceleration provider for ${platform}`);
      } catch (error) {
        console.error(`Error shutting down acceleration provider for ${platform}:`, error);
      }
    }

    this.providers.clear();
    this.capabilities.clear();
    this.initialized = false;
  }
}

/**
 * Hardware capability detection utilities
 */
export class HardwareDetection {
  /**
   * Detect all available acceleration platforms
   */
  public static async detectAccelerationPlatforms(): Promise<AccelerationCapability[]> {
    const capabilities: AccelerationCapability[] = [];

    // This would be a complex implementation that detects hardware
    // Platform-specific detection code would go here
    // For now, we'll return a placeholder that would normally be populated by detection code

    return capabilities;
  }

  /**
   * Benchmark a specific platform
   */
  public static async benchmarkPlatform(platform: AccelerationPlatform): Promise<number> {
    // Benchmark implementation would go here
    // For now, return a placeholder value
    return 0;
  }
}

/**
 * Hardware acceleration utility functions
 */
export const AccelerationUtils = {
  /**
   * Check if a specific platform is available
   */
  isPlatformAvailable: async (platform: AccelerationPlatform): Promise<boolean> => {
    const manager = AccelerationManager.getInstance();
    const capabilities = await manager.getAvailableCapabilities();
    const platformCapabilities = capabilities.get(platform);

    return !!platformCapabilities && platformCapabilities.some(c => c.supported);
  },

  /**
   * Get the best available platform for a task type
   */
  getBestPlatformForTask: async (
    taskType: AccelerationTaskType
  ): Promise<AccelerationPlatform | null> => {
    const manager = AccelerationManager.getInstance();
    const capabilities = await manager.getAvailableCapabilities();

    let bestPlatform: AccelerationPlatform | null = null;
    let bestScore = -1;

    for (const [platform, platformCapabilities] of capabilities.entries()) {
      for (const capability of platformCapabilities) {
        if (
          capability.supported &&
          capability.taskTypes.includes(taskType) &&
          capability.performanceScore !== undefined &&
          capability.performanceScore > bestScore
        ) {
          bestScore = capability.performanceScore;
          bestPlatform = platform;
        }
      }
    }

    return bestPlatform;
  },
};

// Export default singleton for easy importing
export default AccelerationManager.getInstance();
