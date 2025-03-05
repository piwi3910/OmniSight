import express from 'express';
import {
  discoverCameras,
  detectProtocol,
  getCameraCapabilities,
  executePtzCommand,
  getCameraPresets,
  createCameraPreset,
  deleteCameraPreset,
  rebootCamera
} from '../controllers/cameraProtocolController';

const router = express.Router();

// Camera protocol routes
router.post('/discover', discoverCameras);
router.post('/:id/detect-protocol', detectProtocol);
router.get('/:id/capabilities', getCameraCapabilities);
router.post('/:id/ptz', executePtzCommand);
router.get('/:id/presets', getCameraPresets);
router.post('/:id/presets', createCameraPreset);
router.delete('/:id/presets/:presetId', deleteCameraPreset);
router.post('/:id/reboot', rebootCamera);

export default router;