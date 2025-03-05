import express from 'express';
import {
  getIceServers,
  createOffer,
  handleAnswer,
  addIceCandidate,
  closeSession,
  getStreamStats,
  updateStreamConfig,
  updateIceServers
} from '../controllers/webrtcController';

const router = express.Router();

// WebRTC signaling routes
router.get('/ice-servers', getIceServers);
router.post('/offer', createOffer);
router.post('/answer', handleAnswer);
router.post('/ice-candidate', addIceCandidate);
router.delete('/sessions/:sessionId', closeSession);
router.get('/sessions/:sessionId/stats', getStreamStats);
router.put('/sessions/:sessionId/config', updateStreamConfig);
router.put('/ice-servers', updateIceServers);

export default router;