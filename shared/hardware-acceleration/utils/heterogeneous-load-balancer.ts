/**
 * Heterogeneous Hardware Load Balancer
 * 
 * This module provides cross-platform load balancing capabilities across different
 * hardware acceleration platforms (NVIDIA, Intel, AMD, etc.) to optimize performance,
 * power efficiency, and resource utilization.
 */

import {
  AccelerationPlatform,
  AccelerationTaskType,
  AccelerationCapability,
  PerfPowerBalance
} from '../types';

// Import platform-specific balancers
import MultiGPUBalancer, { LoadBalancingStrategy } from './multi-gpu-balancer';
import IntelMultiDeviceManager from './intel-multi-device';

// Optimization objectives
export enum OptimizationObjective {
  MAXIMUM_PERFORMANCE = 'maximum_performance',
  BALANCED = 'balanced',
  POWER_EFFICIENCY = 'power_efficiency',
  LOWEST_LATENCY = 'lowest_latency',
  HIGHEST_THROUGHPUT = 'highest_throughput',
  THERMAL_OPTIMIZATION = 'thermal_optimization'
}

// Platform priority for different task types (lower number = higher priority)
const DEFAULT_PLATFORM_PRIORITIES: Record<AccelerationTaskType, Record<AccelerationPlatform, number>> = {
  [AccelerationTaskType.INFERENCE]: {
    [AccelerationPlatform.NVIDIA_TENSORRT]: 1, // Highest priority
    [AccelerationPlatform.NVIDIA_CUDA]: 2,
    [AccelerationPlatform.INTEL_OPENVINO]: 3,
    [AccelerationPlatform.INTEL_ONEAPI]: 4,
    [AccelerationPlatform.AMD_ROCM]: 5,
    [AccelerationPlatform.GOOGLE_TPU]: 6,
    [AccelerationPlatform.CPU]: 99 // Lowest priority
  },
  [AccelerationTaskType.VIDEO_ENCODING]: {
    [AccelerationPlatform.NVIDIA_CUDA]: 1, // Highest priority
    [AccelerationPlatform.INTEL_ONEAPI]: 2,
    [AccelerationPlatform.AMD_ROCM]: 3,
    [AccelerationPlatform.CPU]: 99 // Lowest priority
  },
  [AccelerationTaskType.VIDEO_DECODING]: {
    [AccelerationPlatform.NVIDIA_CUDA]: 1, // Highest priority
    [AccelerationPlatform.INTEL_ONEAPI]: 2,
    [AccelerationPlatform.AMD_ROCM]: 3,
    [AccelerationPlatform.CPU]: 99 // Lowest priority
  },
  [AccelerationTaskType.IMAGE_PROCESSING]: {
    [AccelerationPlatform.NVIDIA_CUDA]: 1, // Highest priority
    [AccelerationPlatform.INTEL_ONEAPI]: 2,
    [AccelerationPlatform.AMD_ROCM]: 3,
    [AccelerationPlatform.CPU]: 10 // CPU can be relatively good at image processing
  }
};

// Task allocation result
export interface HeterogeneousTaskAllocation {
  taskId: string;
  platform: AccelerationPlatform;
  deviceId: string;
  success: boolean;
  estimatedCompletionTime?: number;
  message?: string;
}

// Task submission parameters
export interface TaskSubmission {
  taskId: string;
  taskType: AccelerationTaskType;
  priority?: number; // 0-100, higher = more important
  requiredMemoryMB?: number;
  estimatedDurationMs?: number;
  preferredPlatform?: AccelerationPlatform;
  requiredCapabilities?: AccelerationCapability[];
  powerEfficiencyPreference?: number; // 0-1, 0 = don't care, 1 = maximum power efficiency
}

// Platform status information
interface PlatformStatus {
  platform: AccelerationPlatform;
  isAvailable: boolean;
  deviceCount: number;
  overallUtilization: number; // 0-1
  memoryUtilization: number; // 0-1
  isOverheating: boolean;
  isPowerConstrained: boolean;
  capabilities: AccelerationCapability[];
}

/**
 * Heterogeneous Hardware Load Balancer
 * 
 * Manages load balancing and task allocation across different hardware acceleration platforms
 */
export class HeterogeneousLoadBalancer {
  private static instance: HeterogeneousLoadBalancer;
  private platformStatuses: Map<AccelerationPlatform, PlatformStatus> = new Map();
  private platformPriorities: Record<AccelerationTaskType, Record<AccelerationPlatform, number>> = DEFAULT_PLATFORM_PRIORITIES;
  private activeTasks: Map<string, { platform: AccelerationPlatform, deviceId: string, taskType: AccelerationTaskType }> = new Map();
  private enabled: boolean = true;
  private optimizationObjective: OptimizationObjective = OptimizationObjective.BALANCED;
  private perfPowerBalance: PerfPowerBalance = 0.5; // Default to balanced
  private interval: NodeJS.Timeout | null = null;
  
  /**
   * Private constructor (singleton)
   */
  private constructor() {
    // Initialize platform statuses
    this.initPlatformStatuses();
    
    // Start monitoring
    this.startMonitoring();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): HeterogeneousLoadBalancer {
    if (!HeterogeneousLoadBalancer.instance) {
      HeterogeneousLoadBalancer.instance = new HeterogeneousLoadBalancer();
    }
    return HeterogeneousLoadBalancer.instance;
  }
  
  /**
   * Initialize platform statuses
   */
  private initPlatformStatuses(): void {
    // Initialize with default values - will be updated by monitoring
    const defaultPlatforms = [
      AccelerationPlatform.NVIDIA_CUDA,
      AccelerationPlatform.NVIDIA_TENSORRT,
      AccelerationPlatform.INTEL_ONEAPI,
      AccelerationPlatform.INTEL_OPENVINO,
      AccelerationPlatform.CPU
    ];
    
    for (const platform of defaultPlatforms) {
      this.platformStatuses.set(platform, {
        platform,
        isAvailable: false,
        deviceCount: 0,
        overallUtilization: 0,
        memoryUtilization: 0,
        isOverheating: false,
        isPowerConstrained: false,
        capabilities: []
      });
    }
  }
  
  /**
   * Start monitoring platform statuses
   */
  private startMonitoring(): void {
    if (this.interval) {
      return;
    }
    
    this.interval = setInterval(() => {
      this.updatePlatformStatuses();
    }, 5000); // Update every 5 seconds
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
   * Update platform statuses
   */
  private async updatePlatformStatuses(): Promise<void> {
    try {
      // Update NVIDIA platform status
      await this.updateNvidiaPlatformStatus();
      
      // Update Intel platform status
      await this.updateIntelPlatformStatus();
      
      // Update CPU platform status
      await this.updateCpuPlatformStatus();
      
      // Update AMD platform status (if available)
      await this.updateAmdPlatformStatus();
      
      // Log platform statuses for debugging
      console.debug('Platform statuses updated:', 
        Array.from(this.platformStatuses.entries())
          .map(([platform, status]) => `${platform}: ${status.isAvailable ? 'Available' : 'Unavailable'}, Utilization: ${Math.round(status.overallUtilization * 100)}%`)
          .join(', '));
    } catch (error) {
      console.error('Error updating platform statuses:', error);
    }
  }
  
  /**
   * Update NVIDIA platform status
   */
  private async updateNvidiaPlatformStatus(): Promise<void> {
    try {
      // Get the multi-GPU balancer
      const nvidiaPlatforms = [
        AccelerationPlatform.NVIDIA_CUDA,
        AccelerationPlatform.NVIDIA_TENSORRT
      ];
      
      // Get device statuses from the multi-GPU balancer
      const deviceStatuses = MultiGPUBalancer.getDeviceStatuses();
      
      if (deviceStatuses.size > 0) {
        for (const platform of nvidiaPlatforms) {
          // Calculate overall utilization as average of all devices
          const avgUtilization = Array.from(deviceStatuses.values())
            .reduce((sum, status) => sum + status.utilization, 0) / deviceStatuses.size;
          
          // Calculate memory utilization
          const totalMemory = Array.from(deviceStatuses.values())
            .reduce((sum, status) => sum + status.memoryTotalMB, 0);
          
          const usedMemory = Array.from(deviceStatuses.values())
            .reduce((sum, status) => sum + status.memoryUsedMB, 0);
          
          const memoryUtilization = totalMemory > 0 ? usedMemory / totalMemory : 0;
          
          // Check for overheating
          const isOverheating = Array.from(deviceStatuses.values())
            .some(status => status.temperature > 80);
          
          // Update platform status
          this.platformStatuses.set(platform, {
            platform,
            isAvailable: true,
            deviceCount: deviceStatuses.size,
            overallUtilization: avgUtilization,
            memoryUtilization,
            isOverheating,
            isPowerConstrained: false, // Simplified
            capabilities: [
              'inference', 'video_decode', 'video_encode', 'image_processing'
            ] as AccelerationCapability[]
          });
        }
      } else {
        // Mark platforms as unavailable
        for (const platform of nvidiaPlatforms) {
          const currentStatus = this.platformStatuses.get(platform);
          if (currentStatus) {
            currentStatus.isAvailable = false;
            currentStatus.deviceCount = 0;
          }
        }
      }
    } catch (error) {
      console.error('Error updating NVIDIA platform status:', error);
    }
  }
  
  /**
   * Update Intel platform status
   */
  private async updateIntelPlatformStatus(): Promise<void> {
    try {
      // Get the Intel multi-device manager
      const intelDeviceManager = IntelMultiDeviceManager;
      
      // Get available devices
      const availableDevices = intelDeviceManager.getAvailableDevices();
      
      if (availableDevices.length > 0) {
        const intelPlatforms = [
          AccelerationPlatform.INTEL_ONEAPI,
          AccelerationPlatform.INTEL_OPENVINO
        ];
        
        for (const platform of intelPlatforms) {
          // Filter to get devices for this platform
          const platformDevices = availableDevices.filter(device => {
            if (platform === AccelerationPlatform.INTEL_ONEAPI) {
              return device.supportsOneAPI;
            } else if (platform === AccelerationPlatform.INTEL_OPENVINO) {
              return device.supportsOpenVINO;
            }
            return false;
          });
          
          if (platformDevices.length > 0) {
            // Calculate overall utilization as average of all devices
            const avgUtilization = platformDevices
              .reduce((sum, device) => sum + device.utilization, 0) / platformDevices.length;
            
            // Calculate memory utilization (simplified)
            const memoryUtilization = 0.5; // Example value
            
            // Check for overheating
            const isOverheating = platformDevices
              .some(device => device.temperature > 80);
            
            // Collect capabilities
            const capabilities = new Set<AccelerationCapability>();
            for (const device of platformDevices) {
              device.capabilities.forEach(cap => capabilities.add(cap));
            }
            
            // Update platform status
            this.platformStatuses.set(platform, {
              platform,
              isAvailable: true,
              deviceCount: platformDevices.length,
              overallUtilization: avgUtilization,
              memoryUtilization,
              isOverheating,
              isPowerConstrained: false,
              capabilities: Array.from(capabilities)
            });
          } else {
            // Mark platform as unavailable
            const currentStatus = this.platformStatuses.get(platform);
            if (currentStatus) {
              currentStatus.isAvailable = false;
              currentStatus.deviceCount = 0;
            }
          }
        }
      } else {
        // Mark Intel platforms as unavailable
        const intelPlatforms = [
          AccelerationPlatform.INTEL_ONEAPI,
          AccelerationPlatform.INTEL_OPENVINO
        ];
        
        for (const platform of intelPlatforms) {
          const currentStatus = this.platformStatuses.get(platform);
          if (currentStatus) {
            currentStatus.isAvailable = false;
            currentStatus.deviceCount = 0;
          }
        }
      }
    } catch (error) {
      console.error('Error updating Intel platform status:', error);
    }
  }
  
  /**
   * Update CPU platform status
   */
  private async updateCpuPlatformStatus(): Promise<void> {
    try {
      // Get CPU metrics
      const os = await import('os');
      
      const cpus = os.cpus();
      const cpuCount = cpus.length;
      
      if (cpuCount > 0) {
        // Calculate CPU utilization
        const totalIdle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
        const totalTick = cpus.reduce((sum, cpu) => 
          sum + cpu.times.idle + cpu.times.user + cpu.times.sys + cpu.times.nice + cpu.times.irq, 0);
        
        const cpuUtilization = 1 - (totalIdle / totalTick);
        
        // Get memory information
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const memoryUtilization = 1 - (freeMemory / totalMemory);
        
        // Update platform status
        this.platformStatuses.set(AccelerationPlatform.CPU, {
          platform: AccelerationPlatform.CPU,
          isAvailable: true,
          deviceCount: 1, // Treat all CPU cores as one device
          overallUtilization: cpuUtilization,
          memoryUtilization,
          isOverheating: false, // No CPU temperature info in Node.js
          isPowerConstrained: false,
          capabilities: [
            'inference', 'image_processing'
          ] as AccelerationCapability[]
        });
      } else {
        // This should never happen, but for completeness
        const currentStatus = this.platformStatuses.get(AccelerationPlatform.CPU);
        if (currentStatus) {
          currentStatus.isAvailable = false;
        }
      }
    } catch (error) {
      console.error('Error updating CPU platform status:', error);
    }
  }
  
  /**
   * Update AMD platform status
   */
  private async updateAmdPlatformStatus(): Promise<void> {
    // TODO: Implement AMD platform status update when AMD support is added
    // Currently a placeholder for future implementation
  }
  
  /**
   * Set optimization objective
   */
  public setOptimizationObjective(objective: OptimizationObjective): void {
    this.optimizationObjective = objective;
    
    // Adjust the multi-GPU balancer strategy based on the objective
    switch (objective) {
      case OptimizationObjective.MAXIMUM_PERFORMANCE:
        MultiGPUBalancer.setStrategy(LoadBalancingStrategy.PERFORMANCE_SCORE);
        // Set Intel devices to performance
        IntelMultiDeviceManager.setPowerProfile('dgpu-0', 'performance');
        this.perfPowerBalance = 1.0;
        break;
      
      case OptimizationObjective.POWER_EFFICIENCY:
        MultiGPUBalancer.setStrategy(LoadBalancingStrategy.POWER_EFFICIENT);
        // Set Intel devices to power saving
        IntelMultiDeviceManager.setPowerProfile('dgpu-0', 'power_saving');
        this.perfPowerBalance = 0.1;
        break;
      
      case OptimizationObjective.BALANCED:
        MultiGPUBalancer.setStrategy(LoadBalancingStrategy.LEAST_UTILIZED);
        // Set Intel devices to balanced
        IntelMultiDeviceManager.setPowerProfile('dgpu-0', 'balanced');
        this.perfPowerBalance = 0.5;
        break;
      
      case OptimizationObjective.LOWEST_LATENCY:
        MultiGPUBalancer.setStrategy(LoadBalancingStrategy.PERFORMANCE_SCORE);
        this.perfPowerBalance = 0.8;
        break;
      
      case OptimizationObjective.HIGHEST_THROUGHPUT:
        MultiGPUBalancer.setStrategy(LoadBalancingStrategy.PERFORMANCE_SCORE);
        this.perfPowerBalance = 0.9;
        break;
      
      case OptimizationObjective.THERMAL_OPTIMIZATION:
        MultiGPUBalancer.setStrategy(LoadBalancingStrategy.LEAST_UTILIZED);
        // Set Intel devices to power saving
        IntelMultiDeviceManager.setPowerProfile('dgpu-0', 'power_saving');
        this.perfPowerBalance = 0.3;
        break;
    }
    
    console.log(`Optimization objective set to ${objective}`);
  }
  
  /**
   * Set performance/power balance
   */
  public setPerfPowerBalance(balance: PerfPowerBalance): void {
    this.perfPowerBalance = balance;
    
    // Adjust platform-specific settings based on the balance
    if (balance < 0.3) {
      // Power saving
      MultiGPUBalancer.setStrategy(LoadBalancingStrategy.POWER_EFFICIENT);
      IntelMultiDeviceManager.setPowerProfile('dgpu-0', 'power_saving');
    } else if (balance > 0.7) {
      // Performance
      MultiGPUBalancer.setStrategy(LoadBalancingStrategy.PERFORMANCE_SCORE);
      IntelMultiDeviceManager.setPowerProfile('dgpu-0', 'performance');
    } else {
      // Balanced
      MultiGPUBalancer.setStrategy(LoadBalancingStrategy.LEAST_UTILIZED);
      IntelMultiDeviceManager.setPowerProfile('dgpu-0', 'balanced');
    }
    
    console.log(`Performance/power balance set to ${balance}`);
  }
  
  /**
   * Enable/disable load balancing
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    
    // Enable/disable platform-specific balancers
    MultiGPUBalancer.setEnabled(enabled);
    IntelMultiDeviceManager.setEnabled(enabled);
    
    if (enabled) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
    }
    
    console.log(`Heterogeneous load balancing ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Submit a task for processing
   */
  public submitTask(task: TaskSubmission): HeterogeneousTaskAllocation {
    if (!this.enabled) {
      return {
        taskId: task.taskId,
        platform: AccelerationPlatform.CPU, // Default
        deviceId: 'none',
        success: false,
        message: 'Load balancing is disabled'
      };
    }
    
    // Update platform statuses
    this.updatePlatformStatuses();
    
    // Determine the best platform for this task
    const platform = this.selectPlatformForTask(task);
    
    if (!platform) {
      return {
        taskId: task.taskId,
        platform: AccelerationPlatform.CPU, // Default to CPU
        deviceId: 'none',
        success: false,
        message: 'No suitable platform available for this task'
      };
    }
    
    // Allocate the task to the selected platform
    return this.allocateTaskToPlatform(task, platform);
  }
  
  /**
   * Select the best platform for a task
   */
  private selectPlatformForTask(task: TaskSubmission): AccelerationPlatform | null {
    // If a specific platform is preferred and available, use it
    if (task.preferredPlatform && 
        this.platformStatuses.get(task.preferredPlatform)?.isAvailable) {
      return task.preferredPlatform;
    }
    
    // Get available platforms
    const availablePlatforms = Array.from(this.platformStatuses.entries())
      .filter(([_, status]) => status.isAvailable)
      .map(([platform, _]) => platform);
    
    if (availablePlatforms.length === 0) {
      return null;
    }
    
    // Get task-specific platform priorities
    const priorities = this.platformPriorities[task.taskType] || {};
    
    // Calculate a score for each platform based on multiple factors
    const scoredPlatforms = availablePlatforms.map(platform => {
      const status = this.platformStatuses.get(platform)!;
      
      // Start with the base priority score (lower priority number = higher score)
      const priorityScore = 100 - (priorities[platform] || 50);
      
      // Penalize for high utilization
      const utilizationPenalty = status.overallUtilization * 50;
      
      // Penalize for high memory utilization
      const memoryPenalty = status.memoryUtilization * 30;
      
      // Heavy penalty for overheating
      const thermalPenalty = status.isOverheating ? 100 : 0;
      
      // Penalty for power constraints
      const powerPenalty = status.isPowerConstrained ? 50 : 0;
      
      // Adjust for power efficiency preference
      const powerEfficiencyAdjustment = (task.powerEfficiencyPreference || 0) * 
        (platform === AccelerationPlatform.CPU ? 30 : 0); // CPU is more power-efficient
      
      // Check if the platform supports all required capabilities
      const hasRequiredCapabilities = !task.requiredCapabilities || 
        task.requiredCapabilities.every(cap => 
          status.capabilities.includes(cap));
      
      // Calculate final score
      const score = hasRequiredCapabilities ? 
        priorityScore - utilizationPenalty - memoryPenalty - thermalPenalty - 
        powerPenalty + powerEfficiencyAdjustment : -1000;
      
      return { platform, score };
    });
    
    // Sort by score (descending) and filter out negative scores
    const rankedPlatforms = scoredPlatforms
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);
    
    // Return the best platform or null if none are suitable
    return rankedPlatforms.length > 0 ? rankedPlatforms[0].platform : null;
  }
  
  /**
   * Allocate a task to a specific platform
   */
  private allocateTaskToPlatform(task: TaskSubmission, platform: AccelerationPlatform): HeterogeneousTaskAllocation {
    try {
      switch (platform) {
        case AccelerationPlatform.NVIDIA_CUDA:
        case AccelerationPlatform.NVIDIA_TENSORRT:
          return this.allocateTaskToNvidia(task, platform);
        
        case AccelerationPlatform.INTEL_ONEAPI:
        case AccelerationPlatform.INTEL_OPENVINO:
          return this.allocateTaskToIntel(task, platform);
        
        case AccelerationPlatform.CPU:
          return this.allocateTaskToCpu(task, platform);
        
        case AccelerationPlatform.AMD_ROCM:
        case AccelerationPlatform.AMD_OPENCL:
          return this.allocateTaskToAmd(task, platform);
        
        default:
          return {
            taskId: task.taskId,
            platform,
            deviceId: 'none',
            success: false,
            message: `Unsupported platform: ${platform}`
          };
      }
    } catch (error) {
      console.error(`Error allocating task ${task.taskId} to platform ${platform}:`, error);
      return {
        taskId: task.taskId,
        platform,
        deviceId: 'error',
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Allocate task to NVIDIA platform
   */
  private allocateTaskToNvidia(task: TaskSubmission, platform: AccelerationPlatform): HeterogeneousTaskAllocation {
    // Use the multi-GPU balancer
    const allocation = MultiGPUBalancer.enqueueTask({
      taskId: task.taskId,
      taskType: task.taskType,
      priority: task.priority !== undefined ? Math.floor(task.priority / 20) : undefined, // Convert 0-100 to 0-5
      requiredMemoryMB: task.requiredMemoryMB,
      estimated_duration_ms: task.estimatedDurationMs
    });
    
    if (!allocation) {
      return {
        taskId: task.taskId,
        platform,
        deviceId: 'none',
        success: false,
        message: 'Task could not be allocated to NVIDIA GPU'
      };
    }
    
    // Store the active task
    this.activeTasks.set(task.taskId, {
      platform,
      deviceId: allocation.deviceId.toString(),
      taskType: task.taskType
    });
    
    return {
      taskId: task.taskId,
      platform,
      deviceId: allocation.deviceId.toString(),
      success: true,
      estimatedCompletionTime: allocation.estimatedCompletionTime
    };
  }
  
  /**
   * Allocate task to Intel platform
   */
  private allocateTaskToIntel(task: TaskSubmission, platform: AccelerationPlatform): HeterogeneousTaskAllocation {
    // Use the Intel multi-device manager
    const allocation = IntelMultiDeviceManager.scheduleTask(task.taskId, task.taskType);
    
    if (!allocation.taskScheduled) {
      return {
        taskId: task.taskId,
        platform,
        deviceId: 'none',
        success: false,
        message: allocation.message || 'Task could not be allocated to Intel device'
      };
    }
    
    // Store the active task
    this.activeTasks.set(task.taskId, {
      platform,
      deviceId: allocation.deviceId,
      taskType: task.taskType
    });
    
    return {
      taskId: task.taskId,
      platform: allocation.platform,
      deviceId: allocation.deviceId,
      success: true
    };
  }
  
  /**
   * Allocate task to CPU
   */
  private allocateTaskToCpu(task: TaskSubmission, platform: AccelerationPlatform): HeterogeneousTaskAllocation {
    // CPU tasks are always accepted
    // In a real implementation, we would check CPU load and limit concurrent tasks
    
    // Store the active task
    this.activeTasks.set(task.taskId, {
      platform,
      deviceId: 'cpu-0',
      taskType: task.taskType
    });
    
    return {
      taskId: task.taskId,
      platform,
      deviceId: 'cpu-0',
      success: true
    };
  }
  
  /**
   * Allocate task to AMD platform
   */
  private allocateTaskToAmd(task: TaskSubmission, platform: AccelerationPlatform): HeterogeneousTaskAllocation {
    // AMD support not implemented yet
    return {
      taskId: task.taskId,
      platform,
      deviceId: 'none',
      success: false,
      message: 'AMD platform support not implemented'
    };
  }
  
  /**
   * Complete a task and release resources
   */
  public completeTask(taskId: string): void {
    // Get task details
    const task = this.activeTasks.get(taskId);
    
    if (!task) {
      return;
    }
    
    // Release resources based on platform
    switch (task.platform) {
      case AccelerationPlatform.NVIDIA_CUDA:
      case AccelerationPlatform.NVIDIA_TENSORRT:
        MultiGPUBalancer.completeTask(taskId);
        break;
      
      case AccelerationPlatform.INTEL_ONEAPI:
      case AccelerationPlatform.INTEL_OPENVINO:
        IntelMultiDeviceManager.completeTask(taskId);
        break;
    }
    
    // Remove task from active tasks
    this.activeTasks.delete(taskId);
  }
  
  /**
   * Get active tasks
   */
  public getActiveTasks(): Map<string, { platform: AccelerationPlatform, deviceId: string, taskType: AccelerationTaskType }> {
    return new Map(this.activeTasks);
  }
  
  /**
   * Get platform statuses
   */
  public getPlatformStatuses(): Map<AccelerationPlatform, PlatformStatus> {
    return new Map(this.platformStatuses);
  }
  
  /**
   * Get task count by platform
   */
  public getTaskCountByPlatform(): Map<AccelerationPlatform, number> {
    const counts = new Map<AccelerationPlatform, number>();
    
    // Initialize counts
    for (const platform of this.platformStatuses.keys()) {
      counts.set(platform, 0);
    }
    
    // Count tasks by platform
    for (const task of this.activeTasks.values()) {
      const count = counts.get(task.platform) || 0;
      counts.set(task.platform, count + 1);
    }
    
    return counts;
  }
  
  /**
   * Get performance statistics
   */
  public async getPerformanceStatistics(): Promise<any> {
    // Platform-specific performance stats
    const platformStats: Record<string, any> = {};
    
    // NVIDIA stats
    const nvidiaDeviceStats = MultiGPUBalancer.getDeviceStatuses();
    if (nvidiaDeviceStats.size > 0) {
      platformStats.nvidia = {
        deviceCount: nvidiaDeviceStats.size,
        devices: Array.from(nvidiaDeviceStats.entries()).map(([id, stats]) => ({
          id,
          utilization: stats.utilization,
          memoryUsed: stats.memoryUsedMB,
          memoryTotal: stats.memoryTotalMB,
          temperature: stats.temperature,
          taskCount: stats.taskCount
        })),
        taskDistribution: Array.from(MultiGPUBalancer.getTaskCountByDevice().entries()),
        memoryUsage: Array.from(MultiGPUBalancer.getMemoryUsageByDevice().entries())
      };
    }
    
    // Intel stats
    const intelDevices = IntelMultiDeviceManager.getAvailableDevices();
    if (intelDevices.length > 0) {
      platformStats.intel = {
        deviceCount: intelDevices.length,
        devices: intelDevices.map(device => ({
          id: device.deviceId,
          type: device.deviceType,
          name: device.deviceName,
          utilization: device.utilization,
          temperature: device.temperature,
          frequency: device.currentFrequencyMHz
        })),
        workloadCounts: Array.from(IntelMultiDeviceManager.getWorkloadCountsByDevice().entries())
      };
    }
    
    // Overall stats
    const stats = {
      activeTasks: this.activeTasks.size,
      tasksByPlatform: Object.fromEntries(this.getTaskCountByPlatform()),
      platformUtilization: Object.fromEntries(
        Array.from(this.platformStatuses.entries())
          .map(([platform, status]) => [platform, status.overallUtilization])
      ),
      optimizationObjective: this.optimizationObjective,
      perfPowerBalance: this.perfPowerBalance,
      platformSpecific: platformStats
    };
    
    return stats;
  }
  
  /**
   * Shutdown and clean up resources
   */
  public shutdown(): void {
    this.stopMonitoring();
    
    // Clean up platform-specific resources
    MultiGPUBalancer.shutdown();
    IntelMultiDeviceManager.shutdown();
    
    // Clear task data
    this.activeTasks.clear();
  }
}

// Export singleton instance
export default HeterogeneousLoadBalancer.getInstance();