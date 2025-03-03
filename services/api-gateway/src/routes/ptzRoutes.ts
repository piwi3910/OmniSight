import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  moveCamera,
  getPresets,
  createPreset,
  gotoPreset,
  deletePreset,
  goHome
} from '../controllers/ptzController';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route   POST /api/cameras/:cameraId/ptz/move
 * @desc    Move a PTZ camera (pan, tilt, zoom)
 * @access  Private
 */
router.post('/cameras/:cameraId/ptz/move', moveCamera);

/**
 * @route   GET /api/cameras/:cameraId/ptz/presets
 * @desc    Get all presets for a PTZ camera
 * @access  Private
 */
router.get('/cameras/:cameraId/ptz/presets', getPresets);

/**
 * @route   POST /api/cameras/:cameraId/ptz/presets
 * @desc    Create a new preset for a PTZ camera
 * @access  Private
 */
router.post('/cameras/:cameraId/ptz/presets', createPreset);

/**
 * @route   POST /api/cameras/:cameraId/ptz/goto-preset
 * @desc    Move a PTZ camera to a saved preset position
 * @access  Private
 */
router.post('/cameras/:cameraId/ptz/goto-preset', gotoPreset);

/**
 * @route   DELETE /api/cameras/:cameraId/ptz/presets/:presetId
 * @desc    Delete a PTZ camera preset
 * @access  Private
 */
router.delete('/cameras/:cameraId/ptz/presets/:presetId', deletePreset);

/**
 * @route   POST /api/cameras/:cameraId/ptz/home
 * @desc    Move a PTZ camera to its home position
 * @access  Private
 */
router.post('/cameras/:cameraId/ptz/home', goHome);

export default router;