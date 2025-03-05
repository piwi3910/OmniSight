import { Request, Response } from 'express';
import { HardwareAccelerationManager } from '../../../shared/hardware-acceleration';
import { Logger } from '../utils/logger';

const logger = new Logger('HardwareAccelerationController');
const hardwareManager = new HardwareAccelerationManager();

/**
 * Get all available hardware acceleration devices
 */
export const getHardwareDevices = async (req: Request, res: Response) => {
  try {
    const devices = await hardwareManager.detectAvailableDevices();
    return res.status(200).json({ devices });
  } catch (error) {
    logger.error('Error detecting hardware devices', { error });
    return res.status(500).json({ error: 'Error detecting hardware devices' });
  }
};

/**
 * Get current hardware acceleration configuration
 */
export const getAccelerationConfig = async (req: Request, res: Response) => {
  try {
    const config = await hardwareManager.getConfiguration();
    return res.status(200).json(config);
  } catch (error) {
    logger.error('Error getting acceleration configuration', { error });
    return res.status(500).json({ error: 'Error getting acceleration configuration' });
  }
};

/**
 * Update hardware acceleration configuration
 */
export const updateAccelerationConfig = async (req: Request, res: Response) => {
  try {
    const { enabled, defaultDevice, profiles } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled status must be a boolean' });
    }
    
    const result = await hardwareManager.updateConfiguration({
      enabled,
      defaultDevice,
      profiles
    });
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error updating acceleration configuration', { error });
    return res.status(500).json({ error: 'Error updating acceleration configuration' });
  }
};

/**
 * Run benchmark on hardware devices
 */
export const runBenchmark = async (req: Request, res: Response) => {
  try {
    const { deviceId, testType } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    const benchmarkResult = await hardwareManager.runBenchmark({
      deviceId,
      testType: testType || 'standard'
    });
    
    return res.status(200).json(benchmarkResult);
  } catch (error) {
    logger.error('Error running hardware benchmark', { error });
    return res.status(500).json({ error: 'Error running hardware benchmark' });
  }
};

/**
 * Get hardware acceleration status for a specific camera
 */
export const getCameraAccelerationStatus = async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    
    if (!cameraId) {
      return res.status(400).json({ error: 'Camera ID is required' });
    }
    
    const status = await hardwareManager.getCameraAccelerationStatus(cameraId);
    return res.status(200).json(status);
  } catch (error) {
    logger.error('Error getting camera acceleration status', { error, cameraId: req.params.cameraId });
    return res.status(500).json({ error: 'Error getting camera acceleration status' });
  }
};

/**
 * Update hardware acceleration for a specific camera
 */
export const updateCameraAcceleration = async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const { enabled, deviceId, profile } = req.body;
    
    if (!cameraId) {
      return res.status(400).json({ error: 'Camera ID is required' });
    }
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled status must be a boolean' });
    }
    
    const result = await hardwareManager.updateCameraAcceleration(cameraId, {
      enabled,
      deviceId,
      profile
    });
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error updating camera acceleration', { error, cameraId: req.params.cameraId });
    return res.status(500).json({ error: 'Error updating camera acceleration' });
  }
};