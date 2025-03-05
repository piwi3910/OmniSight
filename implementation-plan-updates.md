# OmniSight Implementation Plan Updates

Based on a thorough review of the codebase after implementing the proprietary camera protocols, I've identified several integration points that need to be updated to fully leverage the new camera protocol capabilities. These updates will ensure that the functionality we've implemented in the camera protocols is accessible through our API and visible in the frontend.

## Required API Updates

### 1. Camera Model Extension

The current Camera model needs to be extended to support protocol-specific features:

```typescript
// Add to CameraAttributes in Camera.ts
interface CameraAttributes {
  // Existing fields...
  
  // Add new fields
  protocolType: string; // 'hikvision', 'dahua', 'axis', 'onvif', 'rtsp', etc.
  capabilities: {
    ptz: boolean;
    presets: boolean;
    digitalPtz: boolean;
    motionDetection: boolean;
    audio: boolean;
    twoWayAudio: boolean;
    events: boolean;
    ioPorts: boolean;
    privacyMask: boolean;
    configuration: boolean;
    wdr: boolean;
  };
  protocolSettings: object; // Protocol-specific settings
}
```

### 2. Camera Controller API Endpoints

New API endpoints needed in the metadata-events service:

```
POST /cameras/discover             - Discover cameras on the network
POST /cameras/:id/detect-protocol  - Auto-detect protocol for a camera
GET  /cameras/:id/capabilities     - Get camera capabilities
POST /cameras/:id/ptz              - Send PTZ commands
GET  /cameras/:id/presets          - Get camera presets
POST /cameras/:id/presets          - Create a new preset
DELETE /cameras/:id/presets/:presetId - Delete a preset
POST /cameras/:id/reboot           - Reboot camera
```

### 3. Stream Ingestion Service Updates

The Stream Ingestion Service needs to be updated to:

1. Use the protocol abstraction layer to connect to cameras
2. Support protocol auto-detection and fallback
3. Handle protocol-specific stream connection methods
4. Implement protocol-specific health monitoring

## Frontend Component Updates

### 1. Camera Setup & Configuration

The camera setup UI should be extended to include:

1. Protocol selection dropdown with auto-detect option
2. Protocol-specific configuration fields
3. Capability detection and display
4. Test connection functionality for the selected protocol

### 2. Live View Enhancements

The live view component needs:

1. PTZ control panel for cameras with PTZ capability
2. Preset management interface (save, recall, delete)
3. Digital PTZ for cameras without physical PTZ
4. Protocol-specific controls based on detected capabilities

### 3. Camera Settings Page

Update the camera settings page to include:

1. Protocol-specific configuration options
2. Camera capability overview
3. Protocol information display
4. Advanced settings based on camera capabilities

## Documentation Updates

We need to add documentation for:

1. Supported camera protocols and their capabilities
2. Protocol-specific configuration guide
3. API reference for new endpoints
4. Frontend interface for camera protocol features

## Implementation Tasks

### Phase 1: Database & Model Updates

- [ ] Update Camera model schema with protocol fields
- [ ] Create migration for the schema changes
- [ ] Update Camera data validation
- [ ] Add protocol capability detection logic

### Phase 2: Backend API Implementation

- [ ] Create CameraProtocolController in metadata-events service
- [ ] Implement protocol detection endpoints
- [ ] Implement PTZ control endpoints
- [ ] Implement preset management endpoints
- [ ] Update Stream Ingestion service to use protocol abstraction

### Phase 3: Frontend Integration

- [ ] Create/update CameraSetup component with protocol support
- [ ] Implement PTZControl component for live view
- [ ] Create PresetManager component
- [ ] Update camera settings page with protocol options
- [ ] Add capability-based feature toggling in UI

### Phase 4: Testing & Documentation

- [ ] Write unit tests for new endpoints
- [ ] Create integration tests for protocol features
- [ ] Document API changes
- [ ] Update user guide with protocol configuration instructions