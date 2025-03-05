import { Request, Response } from 'express';
import { WebRTCSignalingServer } from '../services/WebRTCSignalingServer';
import { Logger } from '../utils/logger';

const logger = new Logger('WebRTCController');
const signalingServer = WebRTCSignalingServer.getInstance();

/**
 * Get ICE server configuration
 */
export const getIceServers = async (req: Request, res: Response) => {
  try {
    const iceServers = signalingServer.getIceServers();
    return res.status(200).json({ iceServers });
  } catch (error) {
    logger.error('Error getting ICE servers', { error });
    return res.status(500).json({ error: 'Failed to get ICE servers' });
  }
};

/**
 * Create new WebRTC offer
 */
export const createOffer = async (req: Request, res: Response) => {
  try {
    const { cameraId, streamId, clientId, options } = req.body;
    
    if (!cameraId || !clientId) {
      return res.status(400).json({ error: 'Camera ID and client ID are required' });
    }
    
    // Create a new session
    const session = await signalingServer.createSession({
      cameraId,
      streamId: streamId || 'primary',
      clientId,
      options: options || {}
    });
    
    // Create an offer
    const offer = await signalingServer.createOffer(session.id);
    
    return res.status(200).json({
      sessionId: session.id,
      offer
    });
  } catch (error) {
    logger.error('Error creating WebRTC offer', { error });
    return res.status(500).json({ error: 'Failed to create WebRTC offer' });
  }
};

/**
 * Handle client answer to WebRTC offer
 */
export const handleAnswer = async (req: Request, res: Response) => {
  try {
    const { sessionId, answer } = req.body;
    
    if (!sessionId || !answer) {
      return res.status(400).json({ error: 'Session ID and answer are required' });
    }
    
    await signalingServer.handleAnswer(sessionId, answer);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error handling WebRTC answer', { error });
    return res.status(500).json({ error: 'Failed to handle WebRTC answer' });
  }
};

/**
 * Add ICE candidate
 */
export const addIceCandidate = async (req: Request, res: Response) => {
  try {
    const { sessionId, candidate } = req.body;
    
    if (!sessionId || !candidate) {
      return res.status(400).json({ error: 'Session ID and candidate are required' });
    }
    
    await signalingServer.addIceCandidate(sessionId, candidate);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error adding ICE candidate', { error });
    return res.status(500).json({ error: 'Failed to add ICE candidate' });
  }
};

/**
 * Close WebRTC session
 */
export const closeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    await signalingServer.closeSession(sessionId);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error closing WebRTC session', { error });
    return res.status(500).json({ error: 'Failed to close WebRTC session' });
  }
};

/**
 * Get WebRTC stream statistics
 */
export const getStreamStats = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const stats = await signalingServer.getStreamStats(sessionId);
    
    return res.status(200).json(stats);
  } catch (error) {
    logger.error('Error getting WebRTC stream stats', { error });
    return res.status(500).json({ error: 'Failed to get WebRTC stream stats' });
  }
};

/**
 * Update WebRTC stream configuration
 */
export const updateStreamConfig = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { config } = req.body;
    
    if (!sessionId || !config) {
      return res.status(400).json({ error: 'Session ID and configuration are required' });
    }
    
    await signalingServer.updateStreamConfig(sessionId, config);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error updating WebRTC stream configuration', { error });
    return res.status(500).json({ error: 'Failed to update WebRTC stream configuration' });
  }
};

/**
 * Update ICE server configuration
 */
export const updateIceServers = async (req: Request, res: Response) => {
  try {
    const { iceServers } = req.body;
    
    if (!iceServers || !Array.isArray(iceServers)) {
      return res.status(400).json({ error: 'Valid ICE servers configuration is required' });
    }
    
    await signalingServer.setIceServers(iceServers);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error updating ICE server configuration', { error });
    return res.status(500).json({ error: 'Failed to update ICE server configuration' });
  }
};