/**
 * Mobile and Embedded Acceleration Provider
 *
 * This module provides hardware acceleration support for mobile and embedded platforms using:
 * - Google Edge TPU for machine learning inference
 * - Rockchip NPU for embedded device acceleration
 * - Qualcomm Hexagon DSP for mobile device acceleration
 * - ARM Mali GPU for graphics and compute
 * - WebNN for browser-based acceleration
 */

import {
  AccelerationPlatform,
  AccelerationTaskType,
  AccelerationCapability,
  AccelerationProvider,
  AccelerationTask,
  AccelerationResult,
  AccelerationStats,
  AccelerationProviderFactory,
} from '../index';

import {
  GPUDevice,
  DeviceInitializationOptions,
  // The following imports are unused but kept for documentation purposes
  AccelerationContext,
  AccelerationSettings,
  AccelerationStatistics,
  HardwareCapability,
  EncodingParameters,
  DecodingParameters,
  ProcessingOperation,
  ProcessingResult,
  DeviceError,
  EmbeddedDeviceInfo,
  MobileAccelerationOptions,
} from '../../types/hardware-acceleration';

/**
 * Model information interface for hardware acceleration providers
 */
interface ModelInfo {
  path: string;
  inputs: Record<string, { shape: number[]; dtype: string }>;
  outputs: Record<string, { shape: number[]; dtype: string }>;
  options?: unknown;
}

/**
 * Google Edge TPU operations for ML acceleration
 */
interface EdgeTpuOperations {
  initialize(): Promise<boolean>;
  loadModel(modelPath: string): Promise<number>; // Returns model handle
  unloadModel(handle: number): Promise<void>;
  allocateBuffers(modelHandle: number): Promise<Record<string, number>>; // Returns input/output buffers
  freeBuffers(buffers: Record<string, number>): Promise<void>;
  setInputTensor(
    buffers: Record<string, number>,
    inputName: string,
    data: ArrayBuffer
  ): Promise<void>;
  getOutputTensor(buffers: Record<string, number>, outputName: string): Promise<ArrayBuffer>;
  runInference(modelHandle: number, buffers: Record<string, number>): Promise<void>;
  getDeviceInfo(): Promise<GPUDevice>;
}

/**
 * Rockchip NPU operations
 */
interface RockchipNpuOperations {
  initialize(): Promise<boolean>;
  loadModel(modelPath: string, options?: DeviceInitializationOptions): Promise<number>; // Returns model handle
  unloadModel(handle: number): Promise<void>;
  allocateBuffers(modelHandle: number): Promise<Record<string, number>>; // Returns input/output buffers
  freeBuffers(buffers: Record<string, number>): Promise<void>;
  setInputTensor(
    buffers: Record<string, number>,
    inputName: string,
    data: ArrayBuffer
  ): Promise<void>;
  getOutputTensor(buffers: Record<string, number>, outputName: string): Promise<ArrayBuffer>;
  runInference(modelHandle: number, buffers: Record<string, number>): Promise<void>;
  getDeviceInfo(): Promise<GPUDevice>;
}

/**
 * Qualcomm Hexagon DSP operations
 */
interface HexagonDspOperations {
  initialize(): Promise<boolean>;
  loadModel(modelPath: string, options?: DeviceInitializationOptions): Promise<number>; // Returns model handle
  unloadModel(handle: number): Promise<void>;
  allocateBuffers(modelHandle: number): Promise<Record<string, number>>; // Returns input/output buffers
  freeBuffers(buffers: Record<string, number>): Promise<void>;
  setInputTensor(
    buffers: Record<string, number>,
    inputName: string,
    data: ArrayBuffer
  ): Promise<void>;
  getOutputTensor(buffers: Record<string, number>, outputName: string): Promise<ArrayBuffer>;
  runInference(modelHandle: number, buffers: Record<string, number>): Promise<void>;
  getDeviceInfo(): Promise<GPUDevice>;
  // HVX vector operations
  executeVectorKernel(kernelName: string, args: unknown[]): Promise<void>;
}

/**
 * ARM Mali GPU operations
 */
interface MaliGpuOperations {
  initialize(): Promise<boolean>;
  allocateMemory(size: number): Promise<number>; // Returns pointer
  freeMemory(ptr: number): Promise<void>;
  copyHostToDevice(hostPtr: ArrayBuffer, devicePtr: number, size: number): Promise<void>;
  copyDeviceToHost(devicePtr: number, hostPtr: ArrayBuffer, size: number): Promise<void>;
  executeKernel(kernelName: string, args: unknown[]): Promise<void>;
  synchronize(): Promise<void>;
  getDeviceInfo(): Promise<GPUDevice>;
}

/**
 * WebNN operations for browser-based acceleration
 */
interface WebNNOperations {
  initialize(): Promise<boolean>;
  createNeuralNetwork(modelDefinition: unknown): Promise<number>; // Returns network handle
  releaseNeuralNetwork(handle: number): Promise<void>;
  createOperandDescriptors(networkHandle: number): Promise<Record<string, unknown>>;
  setInputOperand(networkHandle: number, name: string, data: ArrayBuffer): Promise<void>;
  getOutputOperand(networkHandle: number, name: string): Promise<ArrayBuffer>;
  compileNetwork(networkHandle: number, options?: DeviceInitializationOptions): Promise<void>;
  computeNetwork(networkHandle: number): Promise<void>;
  getSupportedOperations(): Promise<string[]>;
  getPreferredBackend(): Promise<string>;
}

/**
 * Mock implementations for demo purposes
 * In a real implementation, these would use native bindings or WebAssembly to interface with hardware
 */
class MockEdgeTpuOperations implements EdgeTpuOperations {
  private initialized = false;
  private models = new Map<number, ModelInfo>();
  private nextHandle = 1;

  async initialize(): Promise<boolean> {
    try {
      console.log('Detecting Google Edge TPU devices...');
      // In a real implementation, this would use native bindings to detect Edge TPU devices
      const tpuDetected = Math.random() > 0.2; // 80% chance of success for demo
      if (tpuDetected) {
        this.initialized = true;
        console.log('Google Edge TPU detected');
        return true;
      } else {
        console.log('No Google Edge TPU devices detected');
        return false;
      }
    } catch (error) {
      console.error('Error initializing Google Edge TPU:', error);
      return false;
    }
  }

  async loadModel(modelPath: string): Promise<number> {
    if (!this.initialized) {
      throw new Error('Edge TPU not initialized');
    }

    console.log(`Loading Edge TPU model from: ${modelPath}`);
    // In a real implementation, this would load a quantized tflite model for Edge TPU

    const handle = this.nextHandle++;
    this.models.set(handle, {
      path: modelPath,
      inputs: {
        input: { shape: [1, 320, 320, 3], dtype: 'uint8' }, // Edge TPU typically uses quantized uint8 inputs
      },
      outputs: {
        output: { shape: [1, 1001], dtype: 'uint8' },
      },
    });

    return handle;
  }

  async unloadModel(handle: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('Edge TPU not initialized');
    }
    if (!this.models.has(handle)) {
      throw new Error(`Invalid model handle: ${handle}`);
    }
    this.models.delete(handle);
  }

  async allocateBuffers(modelHandle: number): Promise<Record<string, number>> {
    if (!this.initialized) {
      throw new Error('Edge TPU not initialized');
    }
    if (!this.models.has(modelHandle)) {
      throw new Error(`Invalid model handle: ${modelHandle}`);
    }

    const model = this.models.get(modelHandle)!;

    // Allocate buffers for each input and output
    const allocatedBuffers: Record<string, number> = {};
    for (const [name, _info] of Object.entries(model.inputs)) {
      allocatedBuffers[name] = this.nextHandle++;
    }
    for (const [name, _info] of Object.entries(model.outputs)) {
      allocatedBuffers[name] = this.nextHandle++;
    }

    return allocatedBuffers;
  }

  async freeBuffers(_buffers: Record<string, number>): Promise<void> {
    if (!this.initialized) {
      throw new Error('Edge TPU not initialized');
    }

    // In a real implementation, this would free allocated buffers
  }

  async setInputTensor(
    buffers: Record<string, number>,
    inputName: string,
    _data: ArrayBuffer
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Edge TPU not initialized');
    }
    if (!buffers[inputName]) {
      throw new Error(`Invalid input name: ${inputName}`);
    }

    // In a real implementation, this would copy data to Edge TPU input buffer
  }

  async getOutputTensor(buffers: Record<string, number>, outputName: string): Promise<ArrayBuffer> {
    if (!this.initialized) {
      throw new Error('Edge TPU not initialized');
    }
    if (!buffers[outputName]) {
      throw new Error(`Invalid output name: ${outputName}`);
    }

    // In a real implementation, this would copy data from Edge TPU output buffer
    // Return mock output data
    return new ArrayBuffer(1001); // Mock classification result
  }

  async runInference(modelHandle: number, _buffers: Record<string, number>): Promise<void> {
    if (!this.initialized) {
      throw new Error('Edge TPU not initialized');
    }
    if (!this.models.has(modelHandle)) {
      throw new Error(`Invalid model handle: ${modelHandle}`);
    }

    // In a real implementation, this would execute inference on Edge TPU
    await new Promise(resolve => setTimeout(resolve, 5)); // Edge TPU is very fast, only a few ms delay
  }

  async getDeviceInfo(): Promise<GPUDevice> {
    if (!this.initialized) {
      throw new Error('Edge TPU not initialized');
    }

    // Return device info that matches the GPUDevice interface
    return {
      id: 'edge-tpu-01',
      name: 'Google Edge TPU',
      vendor: 'Google',
      type: 'other',
      memory: 8 * 1024 * 1024, // 8 MB of TPU memory
      compute: {
        computeUnits: 1,
      },
      driver: {
        version: '16.0',
        date: new Date().toISOString().split('T')[0],
      },
      capabilities: ['ML.Inference', 'INT8', 'INT16', 'Quantized'],
      features: {
        tensorAcceleration: true,
        lowPower: true,
        multiModel: true,
      },
      temperature: 45 + Math.random() * 10,
      power: {
        current: 2.5,
        limit: 5.0,
        unit: 'W',
      },
    };
  }
}

class MockRockchipNpuOperations implements RockchipNpuOperations {
  private initialized = false;
  private models = new Map<number, ModelInfo>();
  private nextHandle = 1;

  async initialize(): Promise<boolean> {
    try {
      console.log('Detecting Rockchip NPU...');
      // In a real implementation, this would use native bindings to detect Rockchip NPU
      const npuDetected = Math.random() > 0.2; // 80% chance of success for demo
      if (npuDetected) {
        this.initialized = true;
        console.log('Rockchip NPU detected');
        return true;
      } else {
        console.log('No Rockchip NPU detected');
        return false;
      }
    } catch (error) {
      console.error('Error initializing Rockchip NPU:', error);
      return false;
    }
  }

  async loadModel(modelPath: string, options?: DeviceInitializationOptions): Promise<number> {
    if (!this.initialized) {
      throw new Error('Rockchip NPU not initialized');
    }

    console.log(`Loading Rockchip NPU model from: ${modelPath}`);
    // In a real implementation, this would load a RKNN model

    const handle = this.nextHandle++;
    this.models.set(handle, {
      path: modelPath,
      options,
      inputs: {
        input: { shape: [1, 224, 224, 3], dtype: 'uint8' },
      },
      outputs: {
        output: { shape: [1, 1000], dtype: 'float32' },
      },
    });

    return handle;
  }

  async unloadModel(handle: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('Rockchip NPU not initialized');
    }
    if (!this.models.has(handle)) {
      throw new Error(`Invalid model handle: ${handle}`);
    }
    this.models.delete(handle);
  }

  async allocateBuffers(modelHandle: number): Promise<Record<string, number>> {
    if (!this.initialized) {
      throw new Error('Rockchip NPU not initialized');
    }
    if (!this.models.has(modelHandle)) {
      throw new Error(`Invalid model handle: ${modelHandle}`);
    }

    const model = this.models.get(modelHandle)!;

    // Allocate buffers for each input and output
    const allocatedBuffers: Record<string, number> = {};
    for (const [name, _info] of Object.entries(model.inputs)) {
      allocatedBuffers[name] = this.nextHandle++;
    }
    for (const [name, _info] of Object.entries(model.outputs)) {
      allocatedBuffers[name] = this.nextHandle++;
    }

    return allocatedBuffers;
  }

  async freeBuffers(_buffers: Record<string, number>): Promise<void> {
    if (!this.initialized) {
      throw new Error('Rockchip NPU not initialized');
    }

    // In a real implementation, this would free allocated buffers
  }

  async setInputTensor(
    buffers: Record<string, number>,
    inputName: string,
    _data: ArrayBuffer
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Rockchip NPU not initialized');
    }
    if (!buffers[inputName]) {
      throw new Error(`Invalid input name: ${inputName}`);
    }

    // In a real implementation, this would copy data to NPU input buffer
  }

  async getOutputTensor(buffers: Record<string, number>, outputName: string): Promise<ArrayBuffer> {
    if (!this.initialized) {
      throw new Error('Rockchip NPU not initialized');
    }
    if (!buffers[outputName]) {
      throw new Error(`Invalid output name: ${outputName}`);
    }

    // In a real implementation, this would copy data from NPU output buffer
    // Return mock output data
    return new ArrayBuffer(4000); // 1000 float32 values (4 bytes each)
  }

  async runInference(modelHandle: number, _buffers: Record<string, number>): Promise<void> {
    if (!this.initialized) {
      throw new Error('Rockchip NPU not initialized');
    }
    if (!this.models.has(modelHandle)) {
      throw new Error(`Invalid model handle: ${modelHandle}`);
    }

    // In a real implementation, this would execute inference on NPU
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
  }

  async getDeviceInfo(): Promise<GPUDevice> {
    if (!this.initialized) {
      throw new Error('Rockchip NPU not initialized');
    }

    // Return a properly typed GPUDevice object
    return {
      id: 'rockchip-npu-01',
      name: 'RK3399Pro NPU',
      vendor: 'Rockchip',
      type: 'other',
      memory: 0.5 * 1024 * 1024 * 1024, // 0.5 GB NPU memory
      compute: {
        computeUnits: 3,
      },
      driver: {
        version: '1.6.0',
      },
      capabilities: ['Conv', 'Pool', 'FC', 'BatchNorm', 'Activation'],
      features: {
        tensorAcceleration: true,
        lowPower: true,
        multiModel: false,
      },
      performance: {
        computePower: 3.0, // TOPS
      },
      temperature: 40 + Math.random() * 15,
      power: {
        current: 3.0,
        limit: 5.0,
        unit: 'W',
      },
    };
  }
}

class MockHexagonDspOperations implements HexagonDspOperations {
  private initialized = false;
  private models = new Map<number, ModelInfo>();
  private nextHandle = 1;

  async initialize(): Promise<boolean> {
    try {
      console.log('Detecting Qualcomm Hexagon DSP...');
      // In a real implementation, this would use native bindings to detect Hexagon DSP
      const dspDetected = Math.random() > 0.2; // 80% chance of success for demo
      if (dspDetected) {
        this.initialized = true;
        console.log('Qualcomm Hexagon DSP detected');
        return true;
      } else {
        console.log('No Qualcomm Hexagon DSP detected');
        return false;
      }
    } catch (error) {
      console.error('Error initializing Qualcomm Hexagon DSP:', error);
      return false;
    }
  }

  async loadModel(modelPath: string, options?: DeviceInitializationOptions): Promise<number> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }

    console.log(`Loading Hexagon DSP model from: ${modelPath}`);
    // In a real implementation, this would load a DLC (Deep Learning Container) model

    const handle = this.nextHandle++;
    this.models.set(handle, {
      path: modelPath,
      options,
      inputs: {
        input: { shape: [1, 224, 224, 3], dtype: 'float32' },
      },
      outputs: {
        output: { shape: [1, 1000], dtype: 'float32' },
      },
    });

    return handle;
  }

  async unloadModel(handle: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }
    if (!this.models.has(handle)) {
      throw new Error(`Invalid model handle: ${handle}`);
    }
    this.models.delete(handle);
  }

  async allocateBuffers(modelHandle: number): Promise<Record<string, number>> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }
    if (!this.models.has(modelHandle)) {
      throw new Error(`Invalid model handle: ${modelHandle}`);
    }

    const model = this.models.get(modelHandle)!;

    // Allocate buffers for each input and output
    const allocatedBuffers: Record<string, number> = {};
    for (const [name, _info] of Object.entries(model.inputs)) {
      allocatedBuffers[name] = this.nextHandle++;
    }
    for (const [name, _info] of Object.entries(model.outputs)) {
      allocatedBuffers[name] = this.nextHandle++;
    }

    return allocatedBuffers;
  }

  async freeBuffers(_buffers: Record<string, number>): Promise<void> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }

    // In a real implementation, this would free allocated buffers
  }

  async setInputTensor(
    buffers: Record<string, number>,
    inputName: string,
    _data: ArrayBuffer
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }
    if (!buffers[inputName]) {
      throw new Error(`Invalid input name: ${inputName}`);
    }

    // In a real implementation, this would copy data to DSP input buffer
  }

  async getOutputTensor(buffers: Record<string, number>, outputName: string): Promise<ArrayBuffer> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }
    if (!buffers[outputName]) {
      throw new Error(`Invalid output name: ${outputName}`);
    }

    // In a real implementation, this would copy data from DSP output buffer
    // Return mock output data
    return new ArrayBuffer(4000); // 1000 float32 values (4 bytes each)
  }

  async runInference(modelHandle: number, _buffers: Record<string, number>): Promise<void> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }
    if (!this.models.has(modelHandle)) {
      throw new Error(`Invalid model handle: ${modelHandle}`);
    }

    // In a real implementation, this would execute inference on DSP
    await new Promise(resolve => setTimeout(resolve, 8)); // Simulate work
  }

  async executeVectorKernel(kernelName: string, _args: unknown[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }

    // In a real implementation, this would execute a HVX vector kernel
    console.log(`Executing Hexagon Vector kernel: ${kernelName}`);
    await new Promise(resolve => setTimeout(resolve, 2)); // HVX operations are very fast
  }

  async getDeviceInfo(): Promise<GPUDevice> {
    if (!this.initialized) {
      throw new Error('Hexagon DSP not initialized');
    }

    // Return a properly typed GPUDevice object
    return {
      id: 'hexagon-dsp-01',
      name: 'Qualcomm Hexagon DSP',
      vendor: 'Qualcomm',
      type: 'other',
      memory: 24 * 1024 * 1024, // 24 MB combined memory (8 MB TCM + 16 MB DDR)
      compute: {
        computeUnits: 4, // numThreads
      },
      driver: {
        version: 'v68', // hexagonVersion
        date: new Date().toISOString().split('T')[0],
      },
      capabilities: [
        'Conv2d',
        'DepthwiseConv2d',
        'FullyConnected',
        'MaxPool',
        'AvgPool',
        'Softmax',
        'HVX',
      ],
      features: {
        vectorProcessing: true,
        tensorAcceleration: true,
        lowPower: true,
        hexagonNN: true,
      },
      performance: {
        clockRate: 1500, // MHz
        hvxLength: 1024, // bit-width
      },
      temperature: 38 + Math.random() * 12,
      power: {
        current: 1.5,
        limit: 3.0,
        unit: 'W',
      },
    };
  }
}

class MockMaliGpuOperations implements MaliGpuOperations {
  private initialized = false;
  private memoryAllocations = new Map<number, number>(); // ptr -> size
  private nextPtr = 1;

  async initialize(): Promise<boolean> {
    try {
      console.log('Detecting ARM Mali GPU...');
      // In a real implementation, this would use native bindings to detect Mali GPU
      const gpuDetected = Math.random() > 0.2; // 80% chance of success for demo
      if (gpuDetected) {
        this.initialized = true;
        console.log('ARM Mali GPU detected');
        return true;
      } else {
        console.log('No ARM Mali GPU detected');
        return false;
      }
    } catch (error) {
      console.error('Error initializing ARM Mali GPU:', error);
      return false;
    }
  }

  async allocateMemory(size: number): Promise<number> {
    if (!this.initialized) {
      throw new Error('Mali GPU not initialized');
    }
    const ptr = this.nextPtr++;
    this.memoryAllocations.set(ptr, size);
    return ptr;
  }

  async freeMemory(ptr: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('Mali GPU not initialized');
    }
    if (!this.memoryAllocations.has(ptr)) {
      throw new Error(`Invalid memory pointer: ${ptr}`);
    }
    this.memoryAllocations.delete(ptr);
  }

  async copyHostToDevice(hostPtr: ArrayBuffer, devicePtr: number, size: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('Mali GPU not initialized');
    }
    if (!this.memoryAllocations.has(devicePtr)) {
      throw new Error(`Invalid device pointer: ${devicePtr}`);
    }
    if (this.memoryAllocations.get(devicePtr)! < size) {
      throw new Error('Device memory too small');
    }
    // In a real implementation, this would copy data to GPU memory
  }

  async copyDeviceToHost(devicePtr: number, hostPtr: ArrayBuffer, size: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('Mali GPU not initialized');
    }
    if (!this.memoryAllocations.has(devicePtr)) {
      throw new Error(`Invalid device pointer: ${devicePtr}`);
    }
    if (this.memoryAllocations.get(devicePtr)! < size) {
      throw new Error('Device memory too small');
    }
    // In a real implementation, this would copy data from GPU memory
  }

  async executeKernel(kernelName: string, _args: unknown[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Mali GPU not initialized');
    }
    // In a real implementation, this would execute a compute shader or OpenCL kernel
    console.log(`Executing Mali GPU kernel: ${kernelName}`);
    await new Promise(resolve => setTimeout(resolve, 15)); // Simulate work
  }

  async synchronize(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Mali GPU not initialized');
    }
    // In a real implementation, this would synchronize GPU operations
    await new Promise(resolve => setTimeout(resolve, 5)); // Simulate sync
  }

  async getDeviceInfo(): Promise<GPUDevice> {
    if (!this.initialized) {
      throw new Error('Mali GPU not initialized');
    }

    // Return a properly typed GPUDevice object
    return {
      id: 'mali-gpu-01',
      name: 'Mali-G78',
      vendor: 'ARM',
      type: 'mali',
      memory: 4 * 1024 * 1024 * 1024, // 4 GB shared system memory
      compute: {
        computeUnits: 10,
      },
      driver: {
        version: '32.0.0',
        date: new Date().toISOString().split('T')[0],
      },
      capabilities: ['OpenCL 2.0', 'OpenGL ES 3.2', 'Vulkan 1.2', 'Compute', 'Graphics'],
      features: {
        opencl: true,
        vulkan: true,
        opengl: true,
        computeShaders: true,
      },
      performance: {
        frequency: 850, // MHz
        memoryBandwidth: 25.6, // GB/s
      },
      temperature: 42 + Math.random() * 15,
      power: {
        current: 4.0,
        limit: 7.0,
        unit: 'W',
      },
    };
  }
}

class MockWebNNOperations implements WebNNOperations {
  private initialized = false;
  private networks = new Map<number, Record<string, unknown>>();
  private nextHandle = 1;

  async initialize(): Promise<boolean> {
    try {
      console.log('Detecting WebNN support...');
      // In a real implementation, this would check for WebNN API support in the browser
      const webnnSupported = Math.random() > 0.3; // 70% chance of success for demo
      if (webnnSupported) {
        this.initialized = true;
        console.log('WebNN support detected');
        return true;
      } else {
        console.log('No WebNN support detected');
        return false;
      }
    } catch (error) {
      console.error('Error initializing WebNN:', error);
      return false;
    }
  }

  async createNeuralNetwork(modelDefinition: unknown): Promise<number> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }

    console.log('Creating WebNN neural network');

    const handle = this.nextHandle++;
    // Create a default network structure with type safety
    const defaultInputs = { input: { shape: [1, 224, 224, 3], dtype: 'float32' } };
    const defaultOutputs = { output: { shape: [1, 1000], dtype: 'float32' } };

    // Type guard for the modelDefinition to safely access its properties
    const getInputs = () => {
      if (
        modelDefinition &&
        typeof modelDefinition === 'object' &&
        modelDefinition !== null &&
        'inputs' in modelDefinition &&
        modelDefinition.inputs
      ) {
        return modelDefinition.inputs;
      }
      return defaultInputs;
    };

    const getOutputs = () => {
      if (
        modelDefinition &&
        typeof modelDefinition === 'object' &&
        modelDefinition !== null &&
        'outputs' in modelDefinition &&
        modelDefinition.outputs
      ) {
        return modelDefinition.outputs;
      }
      return defaultOutputs;
    };

    this.networks.set(handle, {
      definition: modelDefinition,
      inputs: getInputs(),
      outputs: getOutputs(),
      compiled: false,
    });

    return handle;
  }

  async releaseNeuralNetwork(handle: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }
    if (!this.networks.has(handle)) {
      throw new Error(`Invalid network handle: ${handle}`);
    }
    this.networks.delete(handle);
  }

  async createOperandDescriptors(networkHandle: number): Promise<Record<string, unknown>> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }
    if (!this.networks.has(networkHandle)) {
      throw new Error(`Invalid network handle: ${networkHandle}`);
    }

    const network = this.networks.get(networkHandle)!;

    // Create operand descriptors for inputs and outputs
    const descriptors: Record<string, unknown> = {};

    // Type guard to safely process the inputs and outputs as Records
    const processNetworkIO = (ioObj: unknown, ioType: 'input' | 'output'): void => {
      if (ioObj && typeof ioObj === 'object' && ioObj !== null) {
        // Safe to process as a Record
        Object.entries(ioObj as Record<string, unknown>).forEach(([name, info]) => {
          if (info && typeof info === 'object' && info !== null) {
            const infoObj = info as Record<string, unknown>;
            descriptors[name] = {
              type: ioType,
              dimensions: 'shape' in infoObj ? infoObj.shape : [1, 1],
              dataType: 'dtype' in infoObj ? infoObj.dtype : 'float32',
            };
          }
        });
      }
    };

    // Process inputs and outputs safely
    if (network && typeof network === 'object' && network !== null) {
      if ('inputs' in network && network.inputs) {
        processNetworkIO(network.inputs, 'input');
      }

      if ('outputs' in network && network.outputs) {
        processNetworkIO(network.outputs, 'output');
      }
    }

    return descriptors;
  }

  async setInputOperand(networkHandle: number, name: string, _data: ArrayBuffer): Promise<void> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }
    if (!this.networks.has(networkHandle)) {
      throw new Error(`Invalid network handle: ${networkHandle}`);
    }

    const network = this.networks.get(networkHandle)!;

    // Type guard for network.inputs
    if (
      network &&
      typeof network === 'object' &&
      network !== null &&
      'inputs' in network &&
      network.inputs &&
      typeof network.inputs === 'object'
    ) {
      const inputs = network.inputs as Record<string, unknown>;
      if (!(name in inputs)) {
        throw new Error(`Invalid input name: ${name}`);
      }

      // In a real implementation, this would set input operand data
    } else {
      throw new Error('Network has invalid input structure');
    }
  }

  async getOutputOperand(networkHandle: number, name: string): Promise<ArrayBuffer> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }
    if (!this.networks.has(networkHandle)) {
      throw new Error(`Invalid network handle: ${networkHandle}`);
    }

    const network = this.networks.get(networkHandle)!;

    // Type guard for network.outputs
    if (
      network &&
      typeof network === 'object' &&
      network !== null &&
      'outputs' in network &&
      network.outputs &&
      typeof network.outputs === 'object'
    ) {
      const outputs = network.outputs as Record<string, unknown>;
      if (!(name in outputs)) {
        throw new Error(`Invalid output name: ${name}`);
      }

      // In a real implementation, this would get output operand data
      // Return mock output data with safety checks
      const outputInfo = outputs[name] as Record<string, unknown>;

      // Safe default values if shape or dtype are not available
      const getShape = (): number[] => {
        if ('shape' in outputInfo && Array.isArray(outputInfo.shape)) {
          return outputInfo.shape as number[];
        }
        return [1, 1000]; // Default shape
      };

      const getDtype = (): string => {
        if ('dtype' in outputInfo && typeof outputInfo.dtype === 'string') {
          return outputInfo.dtype;
        }
        return 'float32'; // Default dtype
      };

      const outputShape = getShape();
      const outputSize = outputShape.reduce((a: number, b: number) => a * b, 1);
      const bytesPerElement = getDtype() === 'float32' ? 4 : 1;

      return new ArrayBuffer(outputSize * bytesPerElement);
    } else {
      // Return a default buffer if outputs structure is invalid
      return new ArrayBuffer(4000); // 1000 float32 values as a fallback
    }
  }

  async compileNetwork(
    networkHandle: number,
    _options?: DeviceInitializationOptions
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }
    if (!this.networks.has(networkHandle)) {
      throw new Error(`Invalid network handle: ${networkHandle}`);
    }

    const network = this.networks.get(networkHandle)!;

    // In a real implementation, this would compile the network for the target device
    await new Promise(resolve => setTimeout(resolve, 200)); // Compilation can take time

    network.compiled = true;
  }

  async computeNetwork(networkHandle: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }
    if (!this.networks.has(networkHandle)) {
      throw new Error(`Invalid network handle: ${networkHandle}`);
    }

    const network = this.networks.get(networkHandle)!;
    if (!network.compiled) {
      throw new Error('Network not compiled');
    }

    // In a real implementation, this would execute the compiled network
    await new Promise(resolve => setTimeout(resolve, 15)); // Simulate work
  }

  async getSupportedOperations(): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }

    // Mock supported operations
    return [
      'conv2d',
      'add',
      'mul',
      'relu',
      'leakyRelu',
      'sigmoid',
      'tanh',
      'maxPool2d',
      'avgPool2d',
      'concat',
      'flatten',
      'reshape',
      'softmax',
      'gemm',
      'batchNormalization',
    ];
  }

  async getPreferredBackend(): Promise<string> {
    if (!this.initialized) {
      throw new Error('WebNN not initialized');
    }

    // Mock preferred backend, in real implementation would be one of:
    // 'cpu', 'gpu', 'npu', or 'default'
    return 'gpu';
  }
}

/**
 * Mobile and Embedded Acceleration Provider
 */
export class MobileEmbeddedAccelerationProvider implements AccelerationProvider {
  private edgeTpu: EdgeTpuOperations;
  private rockchipNpu: RockchipNpuOperations;
  private hexagonDsp: HexagonDspOperations;
  private maliGpu: MaliGpuOperations;
  private webnn: WebNNOperations;

  private initialized = false;
  private capabilities: AccelerationCapability[] = [];
  private detectedDevices: string[] = [];
  private stats: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    totalExecutionTimeMs: number;
    startTime: number;
    taskHistory: Array<{
      platform: AccelerationPlatform;
      type: AccelerationTaskType;
      success: boolean;
      executionTimeMs: number;
    }>;
  };

  constructor() {
    // Initialize operations
    this.edgeTpu = new MockEdgeTpuOperations();
    this.rockchipNpu = new MockRockchipNpuOperations();
    this.hexagonDsp = new MockHexagonDspOperations();
    this.maliGpu = new MockMaliGpuOperations();
    this.webnn = new MockWebNNOperations();

    // Initialize stats
    this.stats = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalExecutionTimeMs: 0,
      startTime: Date.now(),
      taskHistory: [],
    };
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<boolean> {
    console.log('Initializing Mobile and Embedded acceleration provider...');

    // Initialize all operations
    const edgeTpuInitialized = await this.edgeTpu.initialize();
    const rockchipNpuInitialized = await this.rockchipNpu.initialize();
    const hexagonDspInitialized = await this.hexagonDsp.initialize();
    const maliGpuInitialized = await this.maliGpu.initialize();
    const webnnInitialized = await this.webnn.initialize();

    // We need at least one capability to consider the provider initialized
    this.initialized =
      edgeTpuInitialized ||
      rockchipNpuInitialized ||
      hexagonDspInitialized ||
      maliGpuInitialized ||
      webnnInitialized;

    if (this.initialized) {
      // Track detected devices
      if (edgeTpuInitialized) this.detectedDevices.push('Google Edge TPU');
      if (rockchipNpuInitialized) this.detectedDevices.push('Rockchip NPU');
      if (hexagonDspInitialized) this.detectedDevices.push('Qualcomm Hexagon DSP');
      if (maliGpuInitialized) this.detectedDevices.push('ARM Mali GPU');
      if (webnnInitialized) this.detectedDevices.push('WebNN');

      // Gather capabilities
      await this.refreshCapabilities();

      console.log('Mobile and Embedded acceleration provider initialized successfully');
      console.log('Detected devices:', this.detectedDevices);
      console.log('Capabilities:', this.capabilities);
    } else {
      console.log('Failed to initialize Mobile and Embedded acceleration provider');
    }

    return this.initialized;
  }

  /**
   * Refresh capabilities
   */
  private async refreshCapabilities(): Promise<void> {
    this.capabilities = [];

    try {
      if (await this.edgeTpu.initialize()) {
        // Add Edge TPU capability
        this.capabilities.push({
          platform: AccelerationPlatform.GOOGLE_TPU,
          taskTypes: [AccelerationTaskType.INFERENCE],
          supported: true,
          performanceScore: 6000, // Good for mobile/edge inference
          powerEfficiency: 95, // Very power efficient
          preferenceRank: 1, // Best for mobile/edge inference
        });
      }

      if (await this.rockchipNpu.initialize()) {
        // Add Rockchip NPU capability
        this.capabilities.push({
          platform: AccelerationPlatform.ROCKCHIP_NPU,
          taskTypes: [AccelerationTaskType.INFERENCE],
          supported: true,
          performanceScore: 5000,
          powerEfficiency: 90,
          preferenceRank: 2,
        });
      }

      if (await this.hexagonDsp.initialize()) {
        // Add Hexagon DSP capability
        this.capabilities.push({
          platform: AccelerationPlatform.QUALCOMM_DSP,
          taskTypes: [AccelerationTaskType.INFERENCE, AccelerationTaskType.IMAGE_PROCESSING],
          supported: true,
          performanceScore: 5500,
          powerEfficiency: 85,
          preferenceRank: 2,
        });
      }

      if (await this.maliGpu.initialize()) {
        // Add Mali GPU capability
        this.capabilities.push({
          platform: AccelerationPlatform.ARM_MALI,
          taskTypes: [
            AccelerationTaskType.INFERENCE,
            AccelerationTaskType.IMAGE_PROCESSING,
            AccelerationTaskType.VIDEO_SCALING,
          ],
          supported: true,
          performanceScore: 7000,
          powerEfficiency: 70, // Less power efficient than dedicated accelerators
          preferenceRank: 3,
        });
      }

      if (await this.webnn.initialize()) {
        // Add WebNN capability
        this.capabilities.push({
          platform: AccelerationPlatform.WEBNN,
          taskTypes: [AccelerationTaskType.INFERENCE],
          supported: true,
          performanceScore: 4000, // Varies widely depending on browser/hardware
          powerEfficiency: 60, // Browser-based, less efficient
          preferenceRank: 4,
        });
      }
    } catch (error) {
      console.error('Error refreshing Mobile and Embedded capabilities:', error);
    }
  }

  /**
   * Get provider capabilities
   */
  async getCapabilities(): Promise<AccelerationCapability[]> {
    if (!this.initialized) {
      throw new Error('Mobile and Embedded acceleration provider not initialized');
    }

    return this.capabilities;
  }

  /**
   * Execute an acceleration task
   */
  async executeTask<TInput, TOutput>(
    task: AccelerationTask<TInput, TOutput>
  ): Promise<AccelerationResult<TOutput>> {
    if (!this.initialized) {
      throw new Error('Mobile and Embedded acceleration provider not initialized');
    }

    const startTime = Date.now();
    let platform: AccelerationPlatform = AccelerationPlatform.CPU; // Default to CPU initially
    let success = false;
    let output: TOutput;
    let error: string | undefined;

    try {
      // Determine which platform to use
      if (task.preferredPlatform) {
        platform = task.preferredPlatform;
      } else {
        // Choose the best platform for the task
        platform = this.selectBestPlatformForTask(task.type);
      }

      // Execute the task based on platform and type
      switch (platform) {
        case AccelerationPlatform.GOOGLE_TPU:
          output = (await this.executeEdgeTpuTask(task.input)) as TOutput;
          break;

        case AccelerationPlatform.ROCKCHIP_NPU:
          output = (await this.executeRockchipNpuTask(task.input)) as TOutput;
          break;

        case AccelerationPlatform.QUALCOMM_DSP:
          output = (await this.executeHexagonDspTask(task.input)) as TOutput;
          break;

        case AccelerationPlatform.ARM_MALI:
          output = (await this.executeMaliGpuTask(task.input, task.type)) as TOutput;
          break;

        case AccelerationPlatform.WEBNN:
          output = (await this.executeWebNNTask(task.input)) as TOutput;
          break;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      success = true;
    } catch (e) {
      const err = e as Error;
      error = err.message;
      success = false;

      // Default platform if not determined
      platform = platform || AccelerationPlatform.CPU;

      // Provide a default output for error cases
      output = null as unknown as TOutput;
    }

    const endTime = Date.now();
    const executionTimeMs = endTime - startTime;

    // Update statistics
    this.stats.totalTasks++;
    if (success) {
      this.stats.successfulTasks++;
    } else {
      this.stats.failedTasks++;
    }
    this.stats.totalExecutionTimeMs += executionTimeMs;
    this.stats.taskHistory.push({
      platform,
      type: task.type,
      success,
      executionTimeMs,
    });

    // Trim history if it gets too large
    if (this.stats.taskHistory.length > 1000) {
      this.stats.taskHistory = this.stats.taskHistory.slice(-1000);
    }

    return {
      output,
      platformUsed: platform,
      executionTimeMs,
      success,
      error,
    };
  }

  /**
   * Select best platform for a task
   */
  private selectBestPlatformForTask(taskType: AccelerationTaskType): AccelerationPlatform {
    // Filter capabilities by task type
    const suitableCapabilities = this.capabilities.filter(cap => cap.taskTypes.includes(taskType));

    if (suitableCapabilities.length === 0) {
      // Fall back to CPU if no suitable accelerator
      return AccelerationPlatform.CPU;
    }

    // Sort by preference rank (lower is better)
    suitableCapabilities.sort((a, b) => {
      if (a.preferenceRank !== undefined && b.preferenceRank !== undefined) {
        return a.preferenceRank - b.preferenceRank;
      }
      return 0;
    });

    // Return the platform with the best rank
    return suitableCapabilities[0].platform;
  }

  /**
   * Execute an Edge TPU inference task
   */
  private async executeEdgeTpuTask(input: unknown): Promise<unknown> {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input for Edge TPU task');
    }

    const inputObj = input as { modelPath: string; inputData: Record<string, ArrayBuffer> };
    const { modelPath, inputData } = inputObj;

    // Load model
    const modelHandle = await this.edgeTpu.loadModel(modelPath);

    try {
      // Allocate buffers
      const buffers = await this.edgeTpu.allocateBuffers(modelHandle);

      try {
        // Set input data
        for (const [name, data] of Object.entries(inputData)) {
          await this.edgeTpu.setInputTensor(buffers, name, data as ArrayBuffer);
        }

        // Run inference
        await this.edgeTpu.runInference(modelHandle, buffers);

        // Get output data
        const outputs: Record<string, ArrayBuffer> = {};
        for (const name of Object.keys(buffers).filter(k => !Object.keys(inputData).includes(k))) {
          outputs[name] = await this.edgeTpu.getOutputTensor(buffers, name);
        }

        return { outputs };
      } finally {
        // Free buffers
        await this.edgeTpu.freeBuffers(buffers);
      }
    } finally {
      // Unload model
      await this.edgeTpu.unloadModel(modelHandle);
    }
  }

  /**
   * Execute a Rockchip NPU inference task
   */
  private async executeRockchipNpuTask(input: unknown): Promise<unknown> {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input for Rockchip NPU task');
    }

    const inputObj = input as {
      modelPath: string;
      inputData: Record<string, ArrayBuffer>;
      options?: DeviceInitializationOptions;
    };
    const { modelPath, inputData, options } = inputObj;

    // Load model
    const modelHandle = await this.rockchipNpu.loadModel(modelPath, options);

    try {
      // Allocate buffers
      const buffers = await this.rockchipNpu.allocateBuffers(modelHandle);

      try {
        // Set input data
        for (const [name, data] of Object.entries(inputData)) {
          await this.rockchipNpu.setInputTensor(buffers, name, data as ArrayBuffer);
        }

        // Run inference
        await this.rockchipNpu.runInference(modelHandle, buffers);

        // Get output data
        const outputs: Record<string, ArrayBuffer> = {};
        for (const name of Object.keys(buffers).filter(k => !Object.keys(inputData).includes(k))) {
          outputs[name] = await this.rockchipNpu.getOutputTensor(buffers, name);
        }

        return { outputs };
      } finally {
        // Free buffers
        await this.rockchipNpu.freeBuffers(buffers);
      }
    } finally {
      // Unload model
      await this.rockchipNpu.unloadModel(modelHandle);
    }
  }

  /**
   * Execute a Hexagon DSP task
   */
  private async executeHexagonDspTask(input: unknown): Promise<unknown> {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input for Hexagon DSP task');
    }

    const inputObj = input as {
      modelPath: string;
      inputData: Record<string, ArrayBuffer>;
      options?: DeviceInitializationOptions;
      vectorKernel?: { name: string; args: unknown[] };
    };
    const { modelPath, inputData, options, vectorKernel } = inputObj;

    // If it's a vector kernel operation
    if (vectorKernel) {
      await this.hexagonDsp.executeVectorKernel(vectorKernel.name, vectorKernel.args);
      return { status: 'success' };
    }

    // Input validation for model inference
    if (!modelPath || !inputData) {
      throw new Error('Missing required parameters for Hexagon DSP task');
    }

    // Load model for inference task
    const modelHandle = await this.hexagonDsp.loadModel(modelPath, options);

    try {
      // Allocate buffers
      const buffers = await this.hexagonDsp.allocateBuffers(modelHandle);

      try {
        // Set input data
        for (const [name, data] of Object.entries(inputData)) {
          await this.hexagonDsp.setInputTensor(buffers, name, data as ArrayBuffer);
        }

        // Run inference
        await this.hexagonDsp.runInference(modelHandle, buffers);

        // Get output data
        const outputs: Record<string, ArrayBuffer> = {};
        for (const name of Object.keys(buffers).filter(k => !Object.keys(inputData).includes(k))) {
          outputs[name] = await this.hexagonDsp.getOutputTensor(buffers, name);
        }

        return { outputs };
      } finally {
        // Free buffers
        await this.hexagonDsp.freeBuffers(buffers);
      }
    } finally {
      // Unload model
      await this.hexagonDsp.unloadModel(modelHandle);
    }
  }

  /**
   * Execute a Mali GPU task
   */
  private async executeMaliGpuTask(
    input: unknown,
    taskType: AccelerationTaskType
  ): Promise<unknown> {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input for Mali GPU task');
    }

    const inputObj = input as {
      image: ArrayBuffer;
      params: unknown;
    };
    const { image, params } = inputObj;

    if (!image) {
      throw new Error('Missing required image data for Mali GPU task');
    }

    // Allocate device memory
    const inputPtr = await this.maliGpu.allocateMemory(image.byteLength);
    const outputPtr = await this.maliGpu.allocateMemory(image.byteLength);

    try {
      // Copy input to device
      await this.maliGpu.copyHostToDevice(
        image instanceof ArrayBuffer ? image : new ArrayBuffer(0),
        inputPtr,
        image.byteLength
      );

      // Execute appropriate kernel based on task type
      switch (taskType) {
        case AccelerationTaskType.IMAGE_PROCESSING:
          await this.maliGpu.executeKernel('imageProcessing', [inputPtr, outputPtr, params]);
          break;
        case AccelerationTaskType.VIDEO_SCALING:
          await this.maliGpu.executeKernel('videoScaling', [inputPtr, outputPtr, params]);
          break;
        case AccelerationTaskType.INFERENCE:
          await this.maliGpu.executeKernel('neuralNetInference', [inputPtr, outputPtr, params]);
          break;
        default:
          throw new Error(`Unsupported task type for Mali GPU: ${taskType}`);
      }

      // Synchronize
      await this.maliGpu.synchronize();

      // Copy output from device
      const outputBuffer = new ArrayBuffer(image.byteLength);
      await this.maliGpu.copyDeviceToHost(outputPtr, outputBuffer, image.byteLength);

      return {
        processedData: outputBuffer,
      };
    } finally {
      // Free device memory
      await this.maliGpu.freeMemory(inputPtr);
      await this.maliGpu.freeMemory(outputPtr);
    }
  }

  /**
   * Execute a WebNN task
   */
  private async executeWebNNTask(input: unknown): Promise<unknown> {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input for WebNN task');
    }

    const inputObj = input as {
      modelDefinition: unknown;
      inputData: Record<string, ArrayBuffer>;
      options?: DeviceInitializationOptions;
    };
    const { modelDefinition, inputData, options } = inputObj;

    if (!modelDefinition || !inputData) {
      throw new Error('Missing required parameters for WebNN task');
    }

    // Create neural network
    const networkHandle = await this.webnn.createNeuralNetwork(modelDefinition);

    try {
      // Create operand descriptors
      const descriptors = await this.webnn.createOperandDescriptors(networkHandle);

      // Compile network (with optional compilation options)
      await this.webnn.compileNetwork(networkHandle, options);

      // Set input operands
      for (const [name, data] of Object.entries(inputData)) {
        await this.webnn.setInputOperand(networkHandle, name, data as ArrayBuffer);
      }

      // Compute network
      await this.webnn.computeNetwork(networkHandle);

      // Get output operands
      const outputs: Record<string, ArrayBuffer> = {};
      for (const [name, descriptor] of Object.entries(descriptors)) {
        // Type guard to check if descriptor has the right shape
        if (
          descriptor &&
          typeof descriptor === 'object' &&
          'type' in descriptor &&
          descriptor.type === 'output'
        ) {
          outputs[name] = await this.webnn.getOutputOperand(networkHandle, name);
        }
      }

      return { outputs };
    } finally {
      // Release neural network
      await this.webnn.releaseNeuralNetwork(networkHandle);
    }
  }

  /**
   * Get provider statistics
   */
  async getStatistics(): Promise<AccelerationStats> {
    if (!this.initialized) {
      throw new Error('Mobile and Embedded acceleration provider not initialized');
    }

    // Calculate averages
    const averageExecutionTimeMs =
      this.stats.totalTasks > 0 ? this.stats.totalExecutionTimeMs / this.stats.totalTasks : 0;

    // Get random values for demo purposes
    // In a real implementation, these would come from device-specific APIs
    const deviceUtilization = Math.random() * 0.7 + 0.1; // 10-80% utilization
    const currentTemperature = 35 + Math.random() * 20; // 35-55°C
    const throttling = currentTemperature > 50;

    // Get the most recently used platform, or default to Edge TPU
    const recentTask = this.stats.taskHistory[this.stats.taskHistory.length - 1];
    const platform = recentTask ? recentTask.platform : AccelerationPlatform.GOOGLE_TPU;

    return {
      platform,
      totalTasks: this.stats.totalTasks,
      successfulTasks: this.stats.successfulTasks,
      failedTasks: this.stats.failedTasks,
      averageExecutionTimeMs,
      uptime: (Date.now() - this.stats.startTime) / 1000,
      deviceUtilization,
      currentTemperature,
      throttling,
    };
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Mobile and Embedded acceleration provider...');

    // Nothing to do for mock implementations
    this.initialized = false;
    this.detectedDevices = [];

    console.log('Mobile and Embedded acceleration provider shut down');
  }
}

// Register provider with factory
AccelerationProviderFactory.registerProvider(
  AccelerationPlatform.GOOGLE_TPU,
  () => new MobileEmbeddedAccelerationProvider()
);

AccelerationProviderFactory.registerProvider(
  AccelerationPlatform.ROCKCHIP_NPU,
  () => new MobileEmbeddedAccelerationProvider()
);

AccelerationProviderFactory.registerProvider(
  AccelerationPlatform.QUALCOMM_DSP,
  () => new MobileEmbeddedAccelerationProvider()
);

AccelerationProviderFactory.registerProvider(
  AccelerationPlatform.ARM_MALI,
  () => new MobileEmbeddedAccelerationProvider()
);

AccelerationProviderFactory.registerProvider(
  AccelerationPlatform.WEBNN,
  () => new MobileEmbeddedAccelerationProvider()
);
