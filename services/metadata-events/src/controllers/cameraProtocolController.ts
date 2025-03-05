import { Request, Response } from 'express';
import { Camera, Stream } from '../models';
import { CameraProtocolRegistry } from '../../../shared/camera-protocols/CameraProtocolRegistry';
import { Logger } from '../utils/logger';
import { sequelize } from '../config/database';

// Initialize logger
const logger = new Logger('CameraProtocolController');

// Initialize protocol registry
const protocolRegistry = new CameraProtocolRegistry();

/**
 * Discover cameras on the network using supported protocols
 */
export const discoverCameras = async (req: Request, res: Response) => {
  try {
    const { networkRange, protocols } = req.body;

    if (!networkRange) {
      return res.status(400).json({ error: 'Network range is required' });
    }

    // Start discovery process
    logger.info('Starting camera discovery', { networkRange, protocols });
    const discoveredCameras = await protocolRegistry.discoverCameras(networkRange, protocols);

    return res.status(200).json({ cameras: discoveredCameras });
  } catch (error) {
    logger.error('Error discovering cameras', { error });
    return res.status(500).json({ error: 'Error discovering cameras' });
  }
};

/**
 * Detect protocol for a specific camera
 */
export const detectProtocol = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get camera details
    const camera = await Camera.findByPk(id);
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    const { ipAddress, username, password } = camera;
    
    if (!ipAddress) {
      return res.status(400).json({ error: 'Camera IP address is required for protocol detection' });
    }
    
    // Attempt to detect protocol
    logger.info('Detecting camera protocol', { cameraId: id, ipAddress });
    const detectedProtocol = await protocolRegistry.detectProtocol({
      host: ipAddress,
      username: username || '',
      password: password || '',
      logger
    });
    
    if (!detectedProtocol) {
      return res.status(404).json({ error: 'No compatible protocol detected' });
    }
    
    // Update camera with detected protocol
    await camera.update({
      protocolType: detectedProtocol.protocolId,
      model: detectedProtocol.metadata.model || camera.model,
      settings: {
        ...camera.settings,
        protocolSettings: detectedProtocol.metadata
      }
    });
    
    return res.status(200).json({ 
      protocol: detectedProtocol.protocolId,
      name: detectedProtocol.protocolName,
      model: detectedProtocol.metadata.model,
      manufacturer: detectedProtocol.metadata.manufacturer
    });
  } catch (error) {
    logger.error('Error detecting camera protocol', { error, cameraId: req.params.id });
    return res.status(500).json({ error: 'Error detecting camera protocol' });
  }
};

/**
 * Get camera capabilities
 */
export const getCameraCapabilities = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get camera details
    const camera = await Camera.findByPk(id);
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    // If we already have capabilities stored, return them
    if (camera.settings?.capabilities) {
      return res.status(200).json({ capabilities: camera.settings.capabilities });
    }
    
    // Otherwise, connect to the camera and get capabilities
    const { ipAddress, username, password, protocolType } = camera;
    
    if (!ipAddress || !protocolType) {
      return res.status(400).json({ 
        error: 'Camera IP address and protocol type are required for capabilities detection' 
      });
    }
    
    // Get protocol instance
    const protocol = protocolRegistry.getProtocol(protocolType, {
      host: ipAddress,
      username: username || '',
      password: password || '',
      logger
    });
    
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not supported' });
    }
    
    // Connect to camera
    await protocol.connect();
    
    // Get capabilities
    const capabilities = protocol.capabilities;
    
    // Update camera with capabilities
    await camera.update({
      settings: {
        ...camera.settings,
        capabilities
      }
    });
    
    return res.status(200).json({ capabilities });
  } catch (error) {
    logger.error('Error getting camera capabilities', { error, cameraId: req.params.id });
    return res.status(500).json({ error: 'Error getting camera capabilities' });
  }
};

/**
 * Execute PTZ command on camera
 */
export const executePtzCommand = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, params } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'PTZ action is required' });
    }
    
    // Get camera details
    const camera = await Camera.findByPk(id);
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    const { ipAddress, username, password, protocolType } = camera;
    
    if (!ipAddress || !protocolType) {
      return res.status(400).json({ error: 'Camera IP address and protocol type are required for PTZ control' });
    }
    
    // Check if camera has PTZ capability
    if (!camera.settings?.capabilities?.ptz) {
      return res.status(400).json({ error: 'Camera does not support PTZ' });
    }
    
    // Get protocol instance
    const protocol = protocolRegistry.getProtocol(protocolType, {
      host: ipAddress,
      username: username || '',
      password: password || '',
      logger
    });
    
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not supported' });
    }
    
    // Connect to camera
    await protocol.connect();
    
    // Execute PTZ command
    const result = await protocol.executePTZCommand({
      action,
      params
    });
    
    if (!result) {
      return res.status(400).json({ error: 'Failed to execute PTZ command' });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error executing PTZ command', { error, cameraId: req.params.id });
    return res.status(500).json({ error: 'Error executing PTZ command' });
  }
};

/**
 * Get camera presets
 */
export const getCameraPresets = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get camera details
    const camera = await Camera.findByPk(id);
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    const { ipAddress, username, password, protocolType } = camera;
    
    if (!ipAddress || !protocolType) {
      return res.status(400).json({ error: 'Camera IP address and protocol type are required for preset management' });
    }
    
    // Check if camera has PTZ capability
    if (!camera.settings?.capabilities?.presets) {
      return res.status(400).json({ error: 'Camera does not support presets' });
    }
    
    // Get protocol instance
    const protocol = protocolRegistry.getProtocol(protocolType, {
      host: ipAddress,
      username: username || '',
      password: password || '',
      logger
    });
    
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not supported' });
    }
    
    // Connect to camera
    await protocol.connect();
    
    // Get presets
    const presets = await protocol.getPresets();
    
    return res.status(200).json({ presets });
  } catch (error) {
    logger.error('Error getting camera presets', { error, cameraId: req.params.id });
    return res.status(500).json({ error: 'Error getting camera presets' });
  }
};

/**
 * Create camera preset
 */
export const createCameraPreset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, position } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Preset name is required' });
    }
    
    // Get camera details
    const camera = await Camera.findByPk(id);
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    const { ipAddress, username, password, protocolType } = camera;
    
    if (!ipAddress || !protocolType) {
      return res.status(400).json({ error: 'Camera IP address and protocol type are required for preset management' });
    }
    
    // Check if camera has PTZ capability
    if (!camera.settings?.capabilities?.presets) {
      return res.status(400).json({ error: 'Camera does not support presets' });
    }
    
    // Get protocol instance
    const protocol = protocolRegistry.getProtocol(protocolType, {
      host: ipAddress,
      username: username || '',
      password: password || '',
      logger
    });
    
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not supported' });
    }
    
    // Connect to camera
    await protocol.connect();
    
    // Create preset
    const preset = await protocol.createPreset(name, position);
    
    if (!preset) {
      return res.status(400).json({ error: 'Failed to create preset' });
    }
    
    return res.status(201).json({ preset });
  } catch (error) {
    logger.error('Error creating camera preset', { error, cameraId: req.params.id });
    return res.status(500).json({ error: 'Error creating camera preset' });
  }
};

/**
 * Delete camera preset
 */
export const deleteCameraPreset = async (req: Request, res: Response) => {
  try {
    const { id, presetId } = req.params;
    
    if (!presetId) {
      return res.status(400).json({ error: 'Preset ID is required' });
    }
    
    // Get camera details
    const camera = await Camera.findByPk(id);
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    const { ipAddress, username, password, protocolType } = camera;
    
    if (!ipAddress || !protocolType) {
      return res.status(400).json({ error: 'Camera IP address and protocol type are required for preset management' });
    }
    
    // Check if camera has PTZ capability
    if (!camera.settings?.capabilities?.presets) {
      return res.status(400).json({ error: 'Camera does not support presets' });
    }
    
    // Get protocol instance
    const protocol = protocolRegistry.getProtocol(protocolType, {
      host: ipAddress,
      username: username || '',
      password: password || '',
      logger
    });
    
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not supported' });
    }
    
    // Connect to camera
    await protocol.connect();
    
    // Delete preset
    const success = await protocol.deletePreset(presetId);
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to delete preset' });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error deleting camera preset', { error, cameraId: req.params.id, presetId: req.params.presetId });
    return res.status(500).json({ error: 'Error deleting camera preset' });
  }
};

/**
 * Reboot camera
 */
export const rebootCamera = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get camera details
    const camera = await Camera.findByPk(id);
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    const { ipAddress, username, password, protocolType } = camera;
    
    if (!ipAddress || !protocolType) {
      return res.status(400).json({ error: 'Camera IP address and protocol type are required for reboot' });
    }
    
    // Get protocol instance
    const protocol = protocolRegistry.getProtocol(protocolType, {
      host: ipAddress,
      username: username || '',
      password: password || '',
      logger
    });
    
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not supported' });
    }
    
    // Connect to camera
    await protocol.connect();
    
    // Reboot camera
    const success = await protocol.reboot();
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to reboot camera' });
    }
    
    // Update camera status
    await camera.update({ status: 'offline' });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error rebooting camera', { error, cameraId: req.params.id });
    return res.status(500).json({ error: 'Error rebooting camera' });
  }
};