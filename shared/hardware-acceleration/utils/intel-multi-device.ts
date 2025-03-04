/**
 * Intel Multi-Device Manager
 * 
 * This module provides support for utilizing multiple Intel devices (integrated + discrete GPUs)
 * and optimizing workloads across them.
 */

import {
  AccelerationPlatform,
  AccelerationTaskType,
  AccelerationCapability
} from '../types';
import { PowerProfile, IntelAccelerationPlatforms, IntelAccelerationCapabilities } from '../providers/intel';

// Intel device types
export enum IntelDeviceType {
  INTEGRATED_GPU = 'integrated_gpu',
  DISCRETE_GPU = 'discrete_gpu',
  CPU = 'cpu',
  VPU = 'vpu',
  FPGA = 'fpga'
}

// Device capabilities information
interface DeviceCapabilities {
  deviceId: string;
  deviceType: IntelDeviceType;
  deviceName: string;
  platform: AccelerationPlatform;
  capabilities: AccelerationCapability[];
  memoryMB: number;
  supportsDNN: boolean;
  supportsQSV: boolean;
  supportsOpenVINO: boolean;
  supportsOneAPI: boolean;
  powerProfile: PowerProfile;
  euCount: number; // Execution Units
  maxFrequencyMHz: number;
}

// Device status
interface DeviceStatus extends DeviceCapabilities {
  isAvailable: boolean;
  utilization: number;
  memoryUsedMB: number;
  temperature: number;
  currentFrequencyMHz: number;
  isOptimalForInference: boolean;
  isOptimalForEncoding: boolean;
  isOptimalForDecoding: boolean;
  isOptimalForImageProcessing: boolean;
}

// Task allocation result
interface TaskAllocation {
  deviceId: string;
  deviceType: IntelDeviceType;
  platform: AccelerationPlatform;
  taskScheduled: boolean;
  message?: string;
}

/**
 * Intel Multi-Device Manager
 * 
 * Manages and optimizes workloads across multiple Intel devices including:
 * - Integrated GPUs (e.g., Intel Iris Xe)
 * - Discrete GPUs (e.g., Intel Arc)
 * - CPUs with AVX-512/DL Boost
 * - VPUs (Vision Processing Units)
 * - FPGAs (Programmable Acceleration Cards)
 */
export class IntelMultiDeviceManager {
  private static instance: IntelMultiDeviceManager;
  private devices: Map<string, DeviceStatus> = new Map();
  private workloads: Map<string, AccelerationTaskType> = new Map();
  private lastDetectionTime: number = 0;
  private detectionInterval: number = 60000; // 1 minute
  private maxDeviceTemperature: number = 85; // Celsius
  private enabled: boolean = true;
  
  /**
   * Private constructor (singleton)
   */
  private constructor() {
    // Initialize devices
    this.detectDevices();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): IntelMultiDeviceManager {
    if (!IntelMultiDeviceManager.instance) {
      IntelMultiDeviceManager.instance = new IntelMultiDeviceManager();
    }
    return IntelMultiDeviceManager.instance;
  }
  
  /**
   * Detect available Intel devices
   */
  private async detectDevices(): Promise<void> {
    try {
      // Skip if detection was run recently
      const now = Date.now();
      if (now - this.lastDetectionTime < this.detectionInterval) {
        return;
      }
      
      this.lastDetectionTime = now;
      
      // Reset device map
      this.devices.clear();
      
      // Simulate device detection
      // In a real implementation, this would use oneAPI Level Zero, SYCL, or other Intel APIs
      
      // Simulated integrated GPU
      this.devices.set('igpu-0', {
        deviceId: 'igpu-0',
        deviceType: IntelDeviceType.INTEGRATED_GPU,
        deviceName: 'Intel Iris Xe Graphics',
        platform: IntelAccelerationPlatforms.INTEL_INTEGRATED_GRAPHICS,
        capabilities: [
          IntelAccelerationCapabilities.VIDEO_DECODE,
          IntelAccelerationCapabilities.VIDEO_ENCODE,
          IntelAccelerationCapabilities.INFERENCE,
          IntelAccelerationCapabilities.IMAGE_PROCESSING
        ],
        memoryMB: 4 * 1024, // 4 GB shared memory
        supportsDNN: true,
        supportsQSV: true,
        supportsOpenVINO: true,
        supportsOneAPI: true,
        powerProfile: PowerProfile.BALANCED,
        euCount: 96,
        maxFrequencyMHz: 1350,
        
        // Status properties
        isAvailable: true,
        utilization: 0.1,
        memoryUsedMB: 512,
        temperature: 45,
        currentFrequencyMHz: 900,
        isOptimalForInference: true,
        isOptimalForEncoding: true,
        isOptimalForDecoding: true,
        isOptimalForImageProcessing: true
      });
      
      // Simulated discrete GPU
      this.devices.set('dgpu-0', {
        deviceId: 'dgpu-0',
        deviceType: IntelDeviceType.DISCRETE_GPU,
        deviceName: 'Intel Arc A770',
        platform: IntelAccelerationPlatforms.INTEL_DISCRETE_GRAPHICS,
        capabilities: [
          IntelAccelerationCapabilities.VIDEO_DECODE,
          IntelAccelerationCapabilities.VIDEO_ENCODE,
          IntelAccelerationCapabilities.INFERENCE,
          IntelAccelerationCapabilities.IMAGE_PROCESSING,
          IntelAccelerationCapabilities.RAY_TRACING
        ],
        memoryMB: 16 * 1024, // 16 GB dedicated memory
        supportsDNN: true,
        supportsQSV: true,
        supportsOpenVINO: true,
        supportsOneAPI: true,
        powerProfile: PowerProfile.PERFORMANCE,
        euCount: 512,
        maxFrequencyMHz: 2100,
        
        // Status properties
        isAvailable: true,
        utilization: 0.05,
        memoryUsedMB: 1024,
        temperature: 50,
        currentFrequencyMHz: 1800,
        isOptimalForInference: true,
        isOptimalForEncoding: true,
        isOptimalForDecoding: true,
        isOptimalForImageProcessing: true
      });
      
      // Simulated CPU with AVX-512
      this.devices.set('cpu-0', {
        deviceId: 'cpu-0',
        deviceType: IntelDeviceType.CPU,
        deviceName: 'Intel Xeon with AVX-512',
        platform: AccelerationPlatform.CPU,
        capabilities: [
          IntelAccelerationCapabilities.INFERENCE,
          IntelAccelerationCapabilities.IMAGE_PROCESSING
        ],
        memoryMB: 32 * 1024, // 32 GB system memory
        supportsDNN: true,
        supportsQSV: false,
        supportsOpenVINO: true,
        supportsOneAPI: true,
        powerProfile: PowerProfile.BALANCED,
        euCount: 0, // Not applicable
        maxFrequencyMHz: 3500,
        
        // Status properties
        isAvailable: true,
        utilization: 0.2,
        memoryUsedMB: 8 * 1024,
        temperature: 55,
        currentFrequencyMHz: 3200,
        isOptimalForInference: false, // Better on GPU
        isOptimalForEncoding: false,  // Better on GPU
        isOptimalForDecoding: false,  // Better on GPU
        isOptimalForImageProcessing: true
      });
      
      // Update device suitability for workloads
      this.updateDeviceSuitability();
      
      console.log(`IntelMultiDeviceManager: Detected ${this.devices.size} Intel devices`);
      for (const [deviceId, device] of this.devices.entries()) {
        console.log(`  Device ${deviceId}: ${device.deviceName} (${device.deviceType})`);
      }
    } catch (error) {
      console.error('IntelMultiDeviceManager: Error detecting devices:', error);
    }
  }
  
  /**
   * Update device suitability for different workloads
   */
  private updateDeviceSuitability(): void {
    for (const device of this.devices.values()) {
      // Inference suitability
      if (device.deviceType === IntelDeviceType.DISCRETE_GPU) {
        // Discrete GPU is best for inference
        device.isOptimalForInference = true;
      } else if (device.deviceType === IntelDeviceType.INTEGRATED_GPU) {
        // Integrated GPU is good for inference
        device.isOptimalForInference = device.utilization < 0.7;
      } else if (device.deviceType === IntelDeviceType.CPU && device.supportsDNN) {
        // CPU with DNN support is usable for inference when GPUs are busy
        device.isOptimalForInference = Array.from(this.devices.values())
          .filter(d => d.deviceType === IntelDeviceType.INTEGRATED_GPU || 
                      d.deviceType === IntelDeviceType.DISCRETE_GPU)
          .every(d => d.utilization > 0.8);
      } else {
        device.isOptimalForInference = false;
      }
      
      // Video encoding suitability
      device.isOptimalForEncoding = device.supportsQSV && 
                                  (device.deviceType === IntelDeviceType.INTEGRATED_GPU || 
                                   device.deviceType === IntelDeviceType.DISCRETE_GPU) &&
                                   device.utilization < 0.8;
      
      // Video decoding suitability
      device.isOptimalForDecoding = device.supportsQSV && 
                                  (device.deviceType === IntelDeviceType.INTEGRATED_GPU || 
                                   device.deviceType === IntelDeviceType.DISCRETE_GPU) &&
                                   device.utilization < 0.9;
      
      // Image processing suitability
      device.isOptimalForImageProcessing = (device.deviceType === IntelDeviceType.DISCRETE_GPU && device.utilization < 0.7) ||
                                         (device.deviceType === IntelDeviceType.INTEGRATED_GPU && device.utilization < 0.8) ||
                                         (device.deviceType === IntelDeviceType.CPU && device.utilization < 0.5);
    }
  }
  
  /**
   * Update device status with latest information
   */
  public async updateDeviceStatus(): Promise<void> {
    try {
      // Re-detect devices if needed
      await this.detectDevices();
      
      // In a real implementation, this would query each device for its current status
      // For demonstration, simulate status changes
      
      for (const device of this.devices.values()) {
        // Simulate utilization changes based on workloads
        const workloadCount = Array.from(this.workloads.values())
          .filter(taskType => {
            return (taskType === AccelerationTaskType.INFERENCE && device.isOptimalForInference) ||
                   (taskType === AccelerationTaskType.VIDEO_ENCODING && device.isOptimalForEncoding) ||
                   (taskType === AccelerationTaskType.VIDEO_DECODING && device.isOptimalForDecoding) ||
                   (taskType === AccelerationTaskType.IMAGE_PROCESSING && device.isOptimalForImageProcessing);
          }).length;
        
        // Update utilization based on workload
        const utilizationPerWorkload = device.deviceType === IntelDeviceType.DISCRETE_GPU ? 0.05 : 
                                       device.deviceType === IntelDeviceType.INTEGRATED_GPU ? 0.1 : 0.15;
        
        device.utilization = Math.min(0.9, workloadCount * utilizationPerWorkload);
        
        // Simulate memory usage changes
        const memoryPerWorkload = device.deviceType === IntelDeviceType.DISCRETE_GPU ? 512 : 256;
        device.memoryUsedMB = Math.min(device.memoryMB * 0.9, 1024 + (workloadCount * memoryPerWorkload));
        
        // Simulate temperature changes based on utilization and workload
        const baseTemp = device.deviceType === IntelDeviceType.DISCRETE_GPU ? 40 : 
                        device.deviceType === IntelDeviceType.INTEGRATED_GPU ? 35 : 45;
        
        device.temperature = Math.min(this.maxDeviceTemperature, 
                                     baseTemp + (device.utilization * 30) + (Math.random() * 5));
        
        // Update frequency based on workload and temperature
        const freqRatio = device.temperature > 75 ? 0.7 : 
                         device.temperature > 65 ? 0.8 : 
                         device.temperature > 55 ? 0.9 : 1.0;
        
        device.currentFrequencyMHz = Math.floor(device.maxFrequencyMHz * freqRatio * 
                                              (0.8 + (device.utilization * 0.2)));
      }
      
      // Update device suitability
      this.updateDeviceSuitability();
    } catch (error) {
      console.error('IntelMultiDeviceManager: Error updating device status:', error);
    }
  }
  
  /**
   * Enable or disable the device manager
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`IntelMultiDeviceManager: ${enabled ? 'Enabled' : 'Disabled'}`);
  }
  
  /**
   * Check if a device is available for a specific task type
   */
  private isDeviceAvailableForTask(device: DeviceStatus, taskType: AccelerationTaskType): boolean {
    // Check if device is available at all
    if (!device.isAvailable) {
      return false;
    }
    
    // Check if device supports the required capability
    switch (taskType) {
      case AccelerationTaskType.INFERENCE:
        return device.isOptimalForInference && device.supportsDNN;
      
      case AccelerationTaskType.VIDEO_ENCODING:
        return device.isOptimalForEncoding && device.supportsQSV;
      
      case AccelerationTaskType.VIDEO_DECODING:
        return device.isOptimalForDecoding && device.supportsQSV;
      
      case AccelerationTaskType.IMAGE_PROCESSING:
        return device.isOptimalForImageProcessing;
      
      default:
        return false;
    }
  }
  
  /**
   * Select the best device for a specific task
   */
  private selectDeviceForTask(taskType: AccelerationTaskType): DeviceStatus | null {
    // Get available devices for this task
    const availableDevices = Array.from(this.devices.values())
      .filter(device => this.isDeviceAvailableForTask(device, taskType));
    
    if (availableDevices.length === 0) {
      return null;
    }
    
    // Task-specific selection strategies
    switch (taskType) {
      case AccelerationTaskType.INFERENCE:
        // For inference, prefer devices in this order: discrete GPU, integrated GPU, CPU
        const inferenceOrder = [
          IntelDeviceType.DISCRETE_GPU,
          IntelDeviceType.INTEGRATED_GPU,
          IntelDeviceType.CPU
        ];
        
        // Try each device type in order of preference
        for (const deviceType of inferenceOrder) {
          const matchingDevices = availableDevices.filter(d => d.deviceType === deviceType);
          if (matchingDevices.length > 0) {
            // Select device with lowest utilization within this type
            return matchingDevices.reduce((best, current) => 
              current.utilization < best.utilization ? current : best, matchingDevices[0]);
          }
        }
        break;
      
      case AccelerationTaskType.VIDEO_ENCODING:
      case AccelerationTaskType.VIDEO_DECODING:
        // For video encoding/decoding, prefer devices with QSV support
        const videoDevices = availableDevices.filter(d => d.supportsQSV);
        if (videoDevices.length > 0) {
          // Select device with lowest utilization
          return videoDevices.reduce((best, current) => 
            current.utilization < best.utilization ? current : best, videoDevices[0]);
        }
        break;
      
      case AccelerationTaskType.IMAGE_PROCESSING:
        // For image processing, balance between performance and availability
        // Score each device based on performance and current load
        const scoredDevices = availableDevices.map(device => {
          let performanceScore = 0;
          
          // Base score by device type
          if (device.deviceType === IntelDeviceType.DISCRETE_GPU) performanceScore += 100;
          else if (device.deviceType === IntelDeviceType.INTEGRATED_GPU) performanceScore += 50;
          else if (device.deviceType === IntelDeviceType.CPU) performanceScore += 30;
          
          // Adjust for utilization (lower is better)
          performanceScore *= (1 - device.utilization);
          
          return { device, score: performanceScore };
        });
        
        // Return device with highest score
        if (scoredDevices.length > 0) {
          const bestDevice = scoredDevices.reduce((best, current) => 
            current.score > best.score ? current : best, scoredDevices[0]);
          
          return bestDevice.device;
        }
        break;
    }
    
    // If no specific strategy matched, just return the least utilized device
    return availableDevices.reduce((best, current) => 
      current.utilization < best.utilization ? current : best, availableDevices[0]);
  }
  
  /**
   * Schedule a task on the most appropriate device
   */
  public scheduleTask(taskId: string, taskType: AccelerationTaskType): TaskAllocation {
    if (!this.enabled) {
      return {
        deviceId: 'none',
        deviceType: IntelDeviceType.CPU,
        platform: AccelerationPlatform.CPU,
        taskScheduled: false,
        message: 'Intel Multi-Device Manager is disabled'
      };
    }
    
    // Update device status
    this.updateDeviceStatus();
    
    // Select the best device for this task
    const selectedDevice = this.selectDeviceForTask(taskType);
    
    if (!selectedDevice) {
      return {
        deviceId: 'none',
        deviceType: IntelDeviceType.CPU,
        platform: AccelerationPlatform.CPU,
        taskScheduled: false,
        message: 'No suitable device available for this task'
      };
    }
    
    // Add task to workloads
    this.workloads.set(taskId, taskType);
    
    // Return allocation
    return {
      deviceId: selectedDevice.deviceId,
      deviceType: selectedDevice.deviceType,
      platform: selectedDevice.platform,
      taskScheduled: true
    };
  }
  
  /**
   * Complete a task and release resources
   */
  public completeTask(taskId: string): void {
    // Remove task from workloads
    this.workloads.delete(taskId);
  }
  
  /**
   * Get all available devices
   */
  public getAvailableDevices(): DeviceStatus[] {
    return Array.from(this.devices.values()).filter(device => device.isAvailable);
  }
  
  /**
   * Get device by ID
   */
  public getDevice(deviceId: string): DeviceStatus | undefined {
    return this.devices.get(deviceId);
  }
  
  /**
   * Get active workloads
   */
  public getActiveWorkloads(): Map<string, AccelerationTaskType> {
    return new Map(this.workloads);
  }
  
  /**
   * Get workload counts by device
   */
  public getWorkloadCountsByDevice(): Map<string, number> {
    const counts = new Map<string, number>();
    
    // Initialize counts
    for (const deviceId of this.devices.keys()) {
      counts.set(deviceId, 0);
    }
    
    // Count workloads by device
    for (const [taskId, taskType] of this.workloads.entries()) {
      // Find which device this task would be assigned to
      const selectedDevice = this.selectDeviceForTask(taskType);
      if (selectedDevice) {
        const count = counts.get(selectedDevice.deviceId) || 0;
        counts.set(selectedDevice.deviceId, count + 1);
      }
    }
    
    return counts;
  }
  
  /**
   * Shutdown and clean up resources
   */
  public shutdown(): void {
    this.devices.clear();
    this.workloads.clear();
  }
}

// Export singleton instance
export default IntelMultiDeviceManager.getInstance();