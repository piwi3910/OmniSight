/**
 * Camera Protocol Abstraction Layer
 * 
 * This module provides a unified interface for working with different camera protocols
 * (RTSP, MJPEG, ONVIF, WebRTC, HLS, etc.) through a common abstraction layer.
 * 
 * The abstraction layer follows a layered architecture:
 * 
 * 1. Low-level protocol implementations (RTSPProtocol, MJPEGProtocol, etc.)
 * 2. Abstract base implementation (AbstractCameraProtocol)
 * 3. Protocol registry for discovery and selection (CameraProtocolRegistry)
 * 4. High-level camera management API (CameraManager)
 * 
 * This design allows:
 * - Protocol-agnostic camera operations
 * - Automatic protocol detection and fallback
 * - Simplified camera management
 * - Easy addition of new protocols
 */

// Core interfaces
export * from './interfaces/ICameraProtocol';

// Abstract base implementation
export * from './AbstractCameraProtocol';

// Protocol registry
export * from './CameraProtocolRegistry';

// Camera manager
export * from './CameraManager';

// Protocol implementations
// These will be added as they are implemented
// export * from './protocols/RTSPProtocol';
// export * from './protocols/MJPEGProtocol';
// export * from './protocols/ONVIFProtocol';
// export * from './protocols/WebRTCProtocol';
// export * from './protocols/HLSProtocol';