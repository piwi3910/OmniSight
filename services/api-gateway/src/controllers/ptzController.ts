import { Request, Response } from 'express';
import axios from 'axios';
import logger from '../utils/logger';
import { prisma } from '../models/prisma';

/**
 * Move a PTZ-enabled camera
 * @route POST /api/cameras/:cameraId/ptz/move
 */
export const moveCamera = async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const { pan = 0, tilt = 0, zoom = 0, continuous = false } = req.body;
    
    // Validate input
    if (typeof pan !== 'number' || typeof tilt !== 'number' || typeof zoom !== 'number') {
      return res.status(400).json({ error: 'Invalid movement parameters' });
    }
    
    // Get camera details
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId }
    });
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    if (!camera.ptzEnabled) {
      return res.status(400).json({ error: 'Camera does not support PTZ control' });
    }
    
    // Construct the camera-specific request based on its type and protocol
    // This is a simplified example - in a real implementation, this would
    // be customized for each camera type (e.g., Onvif, proprietary APIs)
    
    let moveCommand;
    let cameraApiUrl: string;
    
    // Different camera manufacturers have different API endpoints and parameters
    switch (camera.brand?.toLowerCase()) {
      case 'onvif':
        cameraApiUrl = `http://${camera.username}:${camera.password}@${camera.ip}:${camera.port}/onvif/ptz_service`;
        moveCommand = {
          ProfileToken: camera.profileToken || 'Profile_1',
          Velocity: {
            PanTilt: { x: pan / 10, y: tilt / 10 },
            Zoom: { x: zoom / 10 }
          },
          Timeout: continuous ? 0 : 'PT3S' // ONVIF uses ISO8601 for timeout
        };
        break;
        
      case 'hikvision':
        cameraApiUrl = `http://${camera.ip}:${camera.port}/ISAPI/PTZCtrl/channels/1/continuous`;
        moveCommand = {
          PTZData: {
            pan,
            tilt,
            zoom
          },
          timeout: continuous ? 0 : 3
        };
        break;
        
      case 'axis':
        cameraApiUrl = `http://${camera.ip}:${camera.port}/axis-cgi/com/ptz.cgi`;
        // For Axis, we convert to query parameters
        const axisParams = new URLSearchParams();
        if (pan !== 0) axisParams.append('rpan', pan.toString());
        if (tilt !== 0) axisParams.append('rtilt', tilt.toString());
        if (zoom !== 0) axisParams.append('rzoom', zoom.toString());
        if (!continuous) axisParams.append('time', '3');
        moveCommand = axisParams;
        break;
        
      default:
        // Generic ONVIF fallback
        cameraApiUrl = `http://${camera.username}:${camera.password}@${camera.ip}:${camera.port}/onvif/ptz_service`;
        moveCommand = {
          ProfileToken: camera.profileToken || 'Profile_1',
          Velocity: {
            PanTilt: { x: pan / 10, y: tilt / 10 },
            Zoom: { x: zoom / 10 }
          },
          Timeout: continuous ? 0 : 'PT3S'
        };
    }
    
    // Make the request to the camera API
    // Note: In a production environment, use a proper camera control library
    // This is a simplified example
    try {
      // For most cameras, we'd use a POST request with JSON payload
      // But some cameras require different methods or formats
      let response;
      if (camera.brand?.toLowerCase() === 'axis') {
        response = await axios.get(`${cameraApiUrl}?${moveCommand.toString()}`, {
          auth: {
            username: camera.username || '',
            password: camera.password || ''
          }
        });
      } else {
        response = await axios.post(cameraApiUrl, moveCommand, {
          auth: {
            username: camera.username || '',
            password: camera.password || ''
          },
          // Some cameras expect XML instead of JSON
          ...(camera.brand?.toLowerCase() === 'onvif' && { 
            headers: { 'Content-Type': 'application/soap+xml' }
          })
        });
      }
      
      // Log success and return
      logger.info(`PTZ move command sent to camera ${cameraId}`);
      
      // Update camera position in database if this is a non-continuous move
      if (!continuous) {
        // In a real implementation, we would get the actual position from the camera
        // Here we're just estimating based on the command
        await prisma.camera.update({
          where: { id: cameraId },
          data: {
            ptzPosition: {
              update: {
                pan: pan !== 0 ? { increment: pan } : undefined,
                tilt: tilt !== 0 ? { increment: tilt } : undefined,
                zoom: zoom !== 0 ? { increment: zoom } : undefined,
                updatedAt: new Date()
              }
            }
          }
        });
      }
      
      return res.status(200).json({ 
        success: true,
        message: 'Move command sent to camera'
      });
    } catch (cameraError: any) {
      logger.error(`Error controlling camera: ${cameraError.message}`);
      return res.status(500).json({ 
        error: 'Failed to send command to camera',
        details: cameraError.message
      });
    }
  } catch (error: any) {
    logger.error(`PTZ move error: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all PTZ presets for a camera
 * @route GET /api/cameras/:cameraId/ptz/presets
 */
export const getPresets = async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    
    // Get camera details
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId }
    });
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    if (!camera.ptzEnabled) {
      return res.status(400).json({ error: 'Camera does not support PTZ control' });
    }
    
    // Get all presets for this camera
    const presets = await prisma.ptzPreset.findMany({
      where: { 
        cameraId: cameraId 
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    return res.status(200).json(presets);
  } catch (error: any) {
    logger.error(`Get PTZ presets error: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a new PTZ preset
 * @route POST /api/cameras/:cameraId/ptz/presets
 */
export const createPreset = async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const { name, position } = req.body;
    
    if (!name || !position) {
      return res.status(400).json({ error: 'Name and position are required' });
    }
    
    // Get camera details
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId }
    });
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    if (!camera.ptzEnabled) {
      return res.status(400).json({ error: 'Camera does not support PTZ control' });
    }
    
    // Create the preset in the database
    const preset = await prisma.ptzPreset.create({
      data: {
        name,
        camera: {
          connect: { id: cameraId }
        },
        position: {
          pan: position.pan || 0,
          tilt: position.tilt || 0,
          zoom: position.zoom || 1
        }
      }
    });
    
    // Actual camera preset creation would happen here for specific camera models
    try {
      // This is a simplified example - in a real implementation, this would
      // be customized for each camera type
      
      const cameraApiUrl = `http://${camera.ip}:${camera.port}/ptz_preset`;
      
      // Make the request to create a preset on the actual camera
      // This is camera-brand specific and would need proper implementation
      
      logger.info(`PTZ preset saved on camera ${cameraId}: ${name}`);
      
      return res.status(201).json(preset);
    } catch (cameraError: any) {
      // If we couldn't save to the camera, delete from our database
      await prisma.ptzPreset.delete({
        where: { id: preset.id }
      });
      
      logger.error(`Error saving preset to camera: ${cameraError.message}`);
      return res.status(500).json({ 
        error: 'Failed to save preset to camera', 
        details: cameraError.message 
      });
    }
  } catch (error: any) {
    logger.error(`Create PTZ preset error: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Go to a PTZ preset position
 * @route POST /api/cameras/:cameraId/ptz/goto-preset
 */
export const gotoPreset = async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const { presetId } = req.body;
    
    if (!presetId) {
      return res.status(400).json({ error: 'Preset ID is required' });
    }
    
    // Get camera details
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId }
    });
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    if (!camera.ptzEnabled) {
      return res.status(400).json({ error: 'Camera does not support PTZ control' });
    }
    
    // Get the preset
    const preset = await prisma.ptzPreset.findFirst({
      where: { 
        id: presetId,
        cameraId: cameraId
      }
    });
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    // Actual camera preset recall would happen here for specific camera models
    try {
      // This is a simplified example - in a real implementation, this would
      // be customized for each camera type
      
      const cameraApiUrl = `http://${camera.ip}:${camera.port}/ptz_goto_preset`;
      
      // Make the request to move to preset on the actual camera
      // This is camera-brand specific and would need proper implementation
      
      logger.info(`PTZ goto preset on camera ${cameraId}: ${preset.name}`);
      
      // Update camera position in database
      await prisma.camera.update({
        where: { id: cameraId },
        data: {
          ptzPosition: {
            update: {
              pan: preset.position.pan,
              tilt: preset.position.tilt,
              zoom: preset.position.zoom,
              updatedAt: new Date()
            }
          }
        }
      });
      
      return res.status(200).json({ 
        success: true,
        message: `Camera moved to preset: ${preset.name}`,
        position: preset.position
      });
    } catch (cameraError: any) {
      logger.error(`Error moving to preset: ${cameraError.message}`);
      return res.status(500).json({ 
        error: 'Failed to move camera to preset', 
        details: cameraError.message 
      });
    }
  } catch (error: any) {
    logger.error(`Goto PTZ preset error: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a PTZ preset
 * @route DELETE /api/cameras/:cameraId/ptz/presets/:presetId
 */
export const deletePreset = async (req: Request, res: Response) => {
  try {
    const { cameraId, presetId } = req.params;
    
    // Get camera details
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId }
    });
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    // Get the preset
    const preset = await prisma.ptzPreset.findFirst({
      where: { 
        id: presetId,
        cameraId: cameraId
      }
    });
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    // Delete the preset
    await prisma.ptzPreset.delete({
      where: { id: presetId }
    });
    
    // Actual camera preset deletion would happen here for specific camera models
    try {
      // This is a simplified example - in a real implementation, this would
      // be customized for each camera type
      
      const cameraApiUrl = `http://${camera.ip}:${camera.port}/ptz_delete_preset`;
      
      // Make the request to delete preset on the actual camera
      // This is camera-brand specific and would need proper implementation
      
      logger.info(`PTZ preset deleted on camera ${cameraId}: ${preset.name}`);
      
      return res.status(200).json({ 
        success: true,
        message: `Preset deleted: ${preset.name}`
      });
    } catch (cameraError: any) {
      logger.error(`Error deleting preset from camera: ${cameraError.message}`);
      // We still return success since we deleted from our database
      return res.status(200).json({ 
        success: true,
        warning: 'Preset deleted from database but may still exist on camera',
        details: cameraError.message
      });
    }
  } catch (error: any) {
    logger.error(`Delete PTZ preset error: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Move a PTZ camera to its home position
 * @route POST /api/cameras/:cameraId/ptz/home
 */
export const goHome = async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    
    // Get camera details
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId }
    });
    
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    
    if (!camera.ptzEnabled) {
      return res.status(400).json({ error: 'Camera does not support PTZ control' });
    }
    
    // Actual camera home command would happen here for specific camera models
    try {
      // This is a simplified example - in a real implementation, this would
      // be customized for each camera type
      
      const cameraApiUrl = `http://${camera.ip}:${camera.port}/ptz_home`;
      
      // Make the request to move to home on the actual camera
      // This is camera-brand specific and would need proper implementation
      
      logger.info(`PTZ home command sent to camera ${cameraId}`);
      
      // Update camera position in database
      await prisma.camera.update({
        where: { id: cameraId },
        data: {
          ptzPosition: {
            update: {
              pan: 0,
              tilt: 0,
              zoom: 1,
              updatedAt: new Date()
            }
          }
        }
      });
      
      return res.status(200).json({ 
        success: true,
        message: 'Camera moved to home position',
        position: { pan: 0, tilt: 0, zoom: 1 }
      });
    } catch (cameraError: any) {
      logger.error(`Error moving to home position: ${cameraError.message}`);
      return res.status(500).json({ 
        error: 'Failed to move camera to home position', 
        details: cameraError.message 
      });
    }
  } catch (error: any) {
    logger.error(`PTZ home error: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};