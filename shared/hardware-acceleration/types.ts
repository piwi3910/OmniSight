/**
 * Hardware acceleration types and interfaces
 */

// Available acceleration platforms
export enum AccelerationPlatform {
  CPU = 'cpu',
  NVIDIA_CUDA = 'nvidia_cuda',
  NVIDIA_TENSORRT = 'nvidia_tensorrt',
  AMD_ROCM = 'amd_rocm',
  AMD_OPENCL = 'amd_opencl',
  INTEL_OPENVINO = 'intel_openvino',
  INTEL_ONEAPI = 'intel_oneapi',
  GOOGLE_TPU = 'google_tpu',
  ARM_NPU = 'arm_npu',
  WEBNN = 'webnn'
}

// Types of acceleration tasks
export enum AccelerationTaskType {
  INFERENCE = 'inference',
  VIDEO_ENCODING = 'video_encoding',
  VIDEO_DECODING = 'video_decoding',
  IMAGE_PROCESSING = 'image_processing'
}

// Hardware acceleration capabilities
export type AccelerationCapability = string;

// Performance-power balance setting (0-1 range)
// 0 = maximum power efficiency, 1 = maximum performance
export type PerfPowerBalance = number;

// Hardware statistics
export interface HardwareStatistics {
  deviceUtilization: number;        // 0-1 range
  memoryUtilizationMB: number;      // Memory usage in MB
  temperatureC?: number;            // Temperature in Celsius
  powerUsageW?: number;             // Power usage in watts
  clockSpeedMHz?: number;           // Clock speed in MHz
  throughputFps?: number;           // Throughput in frames/sec
  latencyMs?: number;               // Latency in milliseconds
  errorCount?: number;              // Number of errors
  uptimeSeconds?: number;           // Uptime in seconds
  currentTemperature?: number;      // Current temperature in Celsius
}

// Acceleration provider interface
export interface AccelerationProvider {
  // Initialize the provider
  initialize(): Promise<boolean>;
  
  // Check if acceleration is supported for a given task
  isAccelerationSupported(taskType: AccelerationTaskType): boolean;
  
  // Clean up resources
  shutdown(): void;
}

// Acceleration manager interface
export interface AccelerationManager {
  // Get instance (singleton)
  getInstance(): AccelerationManager;
  
  // Get available capabilities for each platform
  getAvailableCapabilities(): Promise<Map<AccelerationPlatform, AccelerationCapability[]>>;
  
  // Get statistics for each platform
  getAllStatistics(): Promise<Map<AccelerationPlatform, HardwareStatistics>>;
  
  // Get preferred platform for a task type
  getPreferredPlatform(taskType: AccelerationTaskType): Promise<AccelerationPlatform>;
  
  // Set preferred platform for a task type
  setPreferredPlatform(taskType: AccelerationTaskType, platform: AccelerationPlatform): Promise<boolean>;
  
  // Set performance/power balance (0-1)
  setPerfPowerBalance(balance: PerfPowerBalance): Promise<boolean>;
  
  // Enable/disable hardware acceleration
  setEnabled(enabled: boolean): Promise<boolean>;
}