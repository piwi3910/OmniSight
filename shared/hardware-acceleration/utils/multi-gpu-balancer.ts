/**
 * Multi-GPU Load Balancer for NVIDIA devices
 * 
 * This module provides load balancing capabilities across multiple NVIDIA GPUs
 * to optimize performance and resource utilization.
 */

import { 
  AccelerationPlatform,
  AccelerationTaskType,
  AccelerationManager
} from '../index';
import * as os from 'os';

// Load balancing strategies
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_UTILIZED = 'least_utilized',
  MEMORY_AVAILABLE = 'memory_available',
  PERFORMANCE_SCORE = 'performance_score',
  TASK_SPECIFIC = 'task_specific',
  POWER_EFFICIENT = 'power_efficient'
}

// Device status information
interface DeviceStatus {
  deviceId: number;
  platform: AccelerationPlatform;
  utilization: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  temperature: number;
  performanceScore: number;
  powerEfficiency: number;
  taskCount: number;
  lastTaskTimestamp: number;
}

// Task allocation result
interface TaskAllocation {
  deviceId: number;
  platform: AccelerationPlatform;
  estimatedCompletionTime: number;
}

// Task priority levels
export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4
}

// Task queue entry
interface QueuedTask {
  taskId: string;
  taskType: AccelerationTaskType;
  priority: TaskPriority;
  timestamp: number;
  requiredMemoryMB: number;
  estimated_duration_ms: number;
  preferredDeviceId?: number;
  preferredPlatform?: AccelerationPlatform;
}

/**
 * Multi-GPU Load Balancer
 */
export class MultiGPUBalancer {
  private static instance: MultiGPUBalancer;
  private accelerationManager: AccelerationManager;
  private deviceStatuses: Map<number, DeviceStatus> = new Map();
  private taskQueue: QueuedTask[] = [];
  private taskAllocationMap: Map<string, number> = new Map(); // taskId -> deviceId
  private strategy: LoadBalancingStrategy = LoadBalancingStrategy.LEAST_UTILIZED;
  private roundRobinCounter = 0;
  private enabled = true;
  private interval: NodeJS.Timeout | null = null;
  
  private constructor() {
    // Get the acceleration manager
    this.accelerationManager = AccelerationManager.getInstance();
    
    // Initialize device statuses
    this.initializeDevices();
    
    // Start monitoring
    this.startMonitoring();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): MultiGPUBalancer {
    if (!MultiGPUBalancer.instance) {
      MultiGPUBalancer.instance = new MultiGPUBalancer();
    }
    return MultiGPUBalancer.instance;
  }
  
  /**
   * Initialize device status for all available GPUs
   */
  private async initializeDevices(): Promise<void> {
    try {
      // Get NVIDIA GPUs
      await this.detectNvidiaGPUs();
      
      // Log detected devices
      if (this.deviceStatuses.size > 0) {
        console.log(`MultiGPUBalancer: Detected ${this.deviceStatuses.size} GPU devices`);
        for (const [deviceId, status] of this.deviceStatuses.entries()) {
          console.log(`  Device ${deviceId}: ${status.platform} (${status.memoryTotalMB} MB)`);
        }
      } else {
        console.log('MultiGPUBalancer: No GPU devices detected');
      }
    } catch (error) {
      console.error('MultiGPUBalancer: Error initializing devices:', error);
    }
  }
  
  /**
   * Detect NVIDIA GPUs
   */
  private async detectNvidiaGPUs(): Promise<void> {
    try {
      // In a real implementation, this would use nvidia-smi or NVML to detect GPUs
      // This is a simplification for demonstration purposes
      
      // Get capabilities from acceleration manager
      const capabilities = await this.accelerationManager.getAvailableCapabilities();
      const nvidiaCapabilities = capabilities.get(AccelerationPlatform.NVIDIA_CUDA);
      
      if (nvidiaCapabilities && nvidiaCapabilities.length > 0) {
        // Initialize with detected NVIDIA devices
        for (let i = 0; i < 2; i++) { // Simulate detecting 2 GPUs
          this.deviceStatuses.set(i, {
            deviceId: i,
            platform: AccelerationPlatform.NVIDIA_CUDA,
            utilization: 0,
            memoryUsedMB: 0,
            memoryTotalMB: 8 * 1024, // 8 GB
            temperature: 40,
            performanceScore: 9000 - (i * 1000), // First GPU has better performance
            powerEfficiency: 80 - (i * 10),      // First GPU is more power efficient
            taskCount: 0,
            lastTaskTimestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('MultiGPUBalancer: Error detecting NVIDIA GPUs:', error);
    }
  }
  
  /**
   * Start monitoring device status
   */
  private startMonitoring(): void {
    // Check if already monitoring
    if (this.interval) {
      return;
    }
    
    // Start monitoring interval
    this.interval = setInterval(() => {
      this.updateDeviceStatuses();
      this.processTaskQueue();
    }, 1000); // Update every second
  }
  
  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  /**
   * Update device statuses
   */
  private async updateDeviceStatuses(): Promise<void> {
    try {
      // In a real implementation, this would query GPU status using nvidia-smi or NVML
      // This is a simplification for demonstration purposes
      
      // Get statistics from acceleration manager for each device
      const allStats = await this.accelerationManager.getAllStatistics();
      
      // Update statuses
      for (const [deviceId, status] of this.deviceStatuses.entries()) {
        const platformStats = allStats.get(status.platform);
        
        if (platformStats) {
          // Update status with latest statistics
          status.utilization = platformStats.deviceUtilization;
          status.temperature = platformStats.currentTemperature || 40;
          
          // Simulate memory usage based on task count and utilization
          const memoryPerTask = 200; // MB per task
          status.memoryUsedMB = status.taskCount * memoryPerTask;
          
          // Ensure memory usage is within limits
          status.memoryUsedMB = Math.min(status.memoryUsedMB, status.memoryTotalMB);
        }
      }
    } catch (error) {
      console.error('MultiGPUBalancer: Error updating device statuses:', error);
    }
  }
  
  /**
   * Set load balancing strategy
   */
  public setStrategy(strategy: LoadBalancingStrategy): void {
    this.strategy = strategy;
    console.log(`MultiGPUBalancer: Strategy set to ${strategy}`);
  }
  
  /**
   * Enable/disable load balancing
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    
    if (enabled) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
    }
    
    console.log(`MultiGPUBalancer: ${enabled ? 'Enabled' : 'Disabled'}`);
  }
  
  /**
   * Queue a task for execution
   */
  public enqueueTask(task: {
    taskId: string;
    taskType: AccelerationTaskType;
    priority?: TaskPriority;
    requiredMemoryMB?: number;
    estimated_duration_ms?: number;
    preferredDeviceId?: number;
    preferredPlatform?: AccelerationPlatform;
  }): TaskAllocation | null {
    // Check if enabled
    if (!this.enabled) {
      return null;
    }
    
    // Check if we have any devices
    if (this.deviceStatuses.size === 0) {
      return null;
    }
    
    // Create queued task
    const queuedTask: QueuedTask = {
      taskId: task.taskId,
      taskType: task.taskType,
      priority: task.priority || TaskPriority.NORMAL,
      timestamp: Date.now(),
      requiredMemoryMB: task.requiredMemoryMB || 100,
      estimated_duration_ms: task.estimated_duration_ms || 500,
      preferredDeviceId: task.preferredDeviceId,
      preferredPlatform: task.preferredPlatform
    };
    
    // Try to allocate immediately if possible
    const allocation = this.allocateTask(queuedTask);
    
    if (allocation) {
      // Task was allocated to a device
      return allocation;
    }
    
    // Queue task for later allocation
    this.taskQueue.push(queuedTask);
    
    // Sort task queue by priority and timestamp
    this.taskQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.timestamp - b.timestamp;
    });
    
    return null;
  }
  
  /**
   * Process queued tasks
   */
  private processTaskQueue(): void {
    // Check if queue is empty
    if (this.taskQueue.length === 0) {
      return;
    }
    
    // Try to allocate each queued task
    const remainingTasks: QueuedTask[] = [];
    
    for (const task of this.taskQueue) {
      const allocation = this.allocateTask(task);
      
      if (!allocation) {
        // Could not allocate task, keep in queue
        remainingTasks.push(task);
      }
    }
    
    // Update task queue with remaining tasks
    this.taskQueue = remainingTasks;
  }
  
  /**
   * Allocate a task to a device
   */
  private allocateTask(task: QueuedTask): TaskAllocation | null {
    // Select device based on strategy
    const deviceId = this.selectDevice(task);
    
    if (deviceId === null) {
      // No suitable device found
      return null;
    }
    
    // Get device status
    const status = this.deviceStatuses.get(deviceId)!;
    
    // Check if device has enough memory
    if (status.memoryUsedMB + task.requiredMemoryMB > status.memoryTotalMB) {
      // Not enough memory
      return null;
    }
    
    // Update device status
    status.taskCount++;
    status.memoryUsedMB += task.requiredMemoryMB;
    status.lastTaskTimestamp = Date.now();
    
    // Map task to device
    this.taskAllocationMap.set(task.taskId, deviceId);
    
    // Estimate completion time
    const estimatedCompletionTime = Date.now() + task.estimated_duration_ms;
    
    // Return allocation
    return {
      deviceId,
      platform: status.platform,
      estimatedCompletionTime
    };
  }
  
  /**
   * Select a device for a task based on strategy
   */
  private selectDevice(task: QueuedTask): number | null {
    // Check if a specific device is preferred
    if (task.preferredDeviceId !== undefined && this.deviceStatuses.has(task.preferredDeviceId)) {
      return task.preferredDeviceId;
    }
    
    // Create array of device IDs
    const deviceIds = Array.from(this.deviceStatuses.keys());
    
    // Check if any devices are available
    if (deviceIds.length === 0) {
      return null;
    }
    
    // Select device based on strategy
    switch (this.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.selectRoundRobin();
      
      case LoadBalancingStrategy.LEAST_UTILIZED:
        return this.selectLeastUtilized(task);
      
      case LoadBalancingStrategy.MEMORY_AVAILABLE:
        return this.selectMostMemoryAvailable(task);
      
      case LoadBalancingStrategy.PERFORMANCE_SCORE:
        return this.selectHighestPerformance(task);
      
      case LoadBalancingStrategy.POWER_EFFICIENT:
        return this.selectMostPowerEfficient(task);
      
      case LoadBalancingStrategy.TASK_SPECIFIC:
        return this.selectTaskSpecific(task);
      
      default:
        // Default to least utilized
        return this.selectLeastUtilized(task);
    }
  }
  
  /**
   * Select a device using round-robin strategy
   */
  private selectRoundRobin(): number {
    const deviceIds = Array.from(this.deviceStatuses.keys());
    const deviceId = deviceIds[this.roundRobinCounter % deviceIds.length];
    this.roundRobinCounter++;
    return deviceId;
  }
  
  /**
   * Select device with least utilization
   */
  private selectLeastUtilized(task: QueuedTask): number | null {
    const deviceIds = Array.from(this.deviceStatuses.keys());
    
    let selectedDeviceId: number | null = null;
    let lowestUtilization = 1.1; // Start with value higher than maximum (1.0)
    
    for (const deviceId of deviceIds) {
      const status = this.deviceStatuses.get(deviceId)!;
      
      // Skip if not enough memory
      if (status.memoryUsedMB + task.requiredMemoryMB > status.memoryTotalMB) {
        continue;
      }
      
      // Select device with lowest utilization
      if (status.utilization < lowestUtilization) {
        lowestUtilization = status.utilization;
        selectedDeviceId = deviceId;
      }
    }
    
    return selectedDeviceId;
  }
  
  /**
   * Select device with most available memory
   */
  private selectMostMemoryAvailable(task: QueuedTask): number | null {
    const deviceIds = Array.from(this.deviceStatuses.keys());
    
    let selectedDeviceId: number | null = null;
    let mostAvailableMemory = -1;
    
    for (const deviceId of deviceIds) {
      const status = this.deviceStatuses.get(deviceId)!;
      const availableMemory = status.memoryTotalMB - status.memoryUsedMB;
      
      // Skip if not enough memory
      if (availableMemory < task.requiredMemoryMB) {
        continue;
      }
      
      // Select device with most available memory
      if (availableMemory > mostAvailableMemory) {
        mostAvailableMemory = availableMemory;
        selectedDeviceId = deviceId;
      }
    }
    
    return selectedDeviceId;
  }
  
  /**
   * Select device with highest performance score
   */
  private selectHighestPerformance(task: QueuedTask): number | null {
    const deviceIds = Array.from(this.deviceStatuses.keys());
    
    let selectedDeviceId: number | null = null;
    let highestPerformance = -1;
    
    for (const deviceId of deviceIds) {
      const status = this.deviceStatuses.get(deviceId)!;
      
      // Skip if not enough memory
      if (status.memoryUsedMB + task.requiredMemoryMB > status.memoryTotalMB) {
        continue;
      }
      
      // Select device with highest performance score
      if (status.performanceScore > highestPerformance) {
        highestPerformance = status.performanceScore;
        selectedDeviceId = deviceId;
      }
    }
    
    return selectedDeviceId;
  }
  
  /**
   * Select device with best power efficiency
   */
  private selectMostPowerEfficient(task: QueuedTask): number | null {
    const deviceIds = Array.from(this.deviceStatuses.keys());
    
    let selectedDeviceId: number | null = null;
    let bestPowerEfficiency = -1;
    
    for (const deviceId of deviceIds) {
      const status = this.deviceStatuses.get(deviceId)!;
      
      // Skip if not enough memory
      if (status.memoryUsedMB + task.requiredMemoryMB > status.memoryTotalMB) {
        continue;
      }
      
      // Select device with best power efficiency
      if (status.powerEfficiency > bestPowerEfficiency) {
        bestPowerEfficiency = status.powerEfficiency;
        selectedDeviceId = deviceId;
      }
    }
    
    return selectedDeviceId;
  }
  
  /**
   * Select device specific to task type
   */
  private selectTaskSpecific(task: QueuedTask): number | null {
    const deviceIds = Array.from(this.deviceStatuses.keys());
    
    // Define task-specific device preferences
    const taskDeviceMap: { [key in AccelerationTaskType]?: number } = {
      // Prefer specific devices for specific tasks
      [AccelerationTaskType.INFERENCE]: 0, // Prefer first device for inference
      [AccelerationTaskType.VIDEO_ENCODING]: 1, // Prefer second device for encoding
      [AccelerationTaskType.VIDEO_DECODING]: 1, // Prefer second device for decoding
    };
    
    // Check if task has a specific device preference
    const preferredDeviceId = taskDeviceMap[task.taskType];
    
    if (preferredDeviceId !== undefined && this.deviceStatuses.has(preferredDeviceId)) {
      const status = this.deviceStatuses.get(preferredDeviceId)!;
      
      // Check if device has enough memory
      if (status.memoryUsedMB + task.requiredMemoryMB <= status.memoryTotalMB) {
        return preferredDeviceId;
      }
    }
    
    // Fall back to least utilized strategy
    return this.selectLeastUtilized(task);
  }
  
  /**
   * Complete a task and free device resources
   */
  public completeTask(taskId: string): void {
    // Check if task is allocated
    if (!this.taskAllocationMap.has(taskId)) {
      return;
    }
    
    // Get device ID
    const deviceId = this.taskAllocationMap.get(taskId)!;
    
    // Get device status
    const status = this.deviceStatuses.get(deviceId);
    
    if (status) {
      // Update device status
      status.taskCount = Math.max(0, status.taskCount - 1);
      
      // Find task in queue to get memory requirement
      const task = this.taskQueue.find(t => t.taskId === taskId);
      if (task) {
        status.memoryUsedMB = Math.max(0, status.memoryUsedMB - task.requiredMemoryMB);
      } else {
        // If task not found in queue, assume a default memory requirement
        status.memoryUsedMB = Math.max(0, status.memoryUsedMB - 100);
      }
    }
    
    // Remove task allocation
    this.taskAllocationMap.delete(taskId);
  }
  
  /**
   * Get status of all devices
   */
  public getDeviceStatuses(): Map<number, DeviceStatus> {
    return new Map(this.deviceStatuses);
  }
  
  /**
   * Get task queue
   */
  public getTaskQueue(): QueuedTask[] {
    return [...this.taskQueue];
  }
  
  /**
   * Get task allocation map
   */
  public getTaskAllocationMap(): Map<string, number> {
    return new Map(this.taskAllocationMap);
  }
  
  /**
   * Get task count by device
   */
  public getTaskCountByDevice(): Map<number, number> {
    const result = new Map<number, number>();
    
    for (const [deviceId, status] of this.deviceStatuses.entries()) {
      result.set(deviceId, status.taskCount);
    }
    
    return result;
  }
  
  /**
   * Get memory usage by device
   */
  public getMemoryUsageByDevice(): Map<number, { used: number, total: number }> {
    const result = new Map<number, { used: number, total: number }>();
    
    for (const [deviceId, status] of this.deviceStatuses.entries()) {
      result.set(deviceId, {
        used: status.memoryUsedMB,
        total: status.memoryTotalMB
      });
    }
    
    return result;
  }
  
  /**
   * Shutdown and clean up resources
   */
  public shutdown(): void {
    this.stopMonitoring();
    this.deviceStatuses.clear();
    this.taskQueue = [];
    this.taskAllocationMap.clear();
  }
}

// Export singleton instance
export default MultiGPUBalancer.getInstance();