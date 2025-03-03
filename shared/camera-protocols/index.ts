/**
 * Camera Protocols Module
 * 
 * This module exports the camera protocol interfaces and implementations
 * for use by the rest of the application.
 */

// Export protocol interfaces
export * from './interfaces/ICameraProtocol';

// Export base abstract protocol
export * from './AbstractCameraProtocol';

// Export protocol implementations
export * from './protocols/MJPEGProtocol';
export * from './protocols/ONVIFProtocol';
export * from './protocols/WebRTCProtocol';

// Export camera management
export * from './CameraProtocolRegistry';
export * from './CameraManager';