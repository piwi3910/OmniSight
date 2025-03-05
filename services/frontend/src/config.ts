// Base URL for API requests
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api';

// Authentication token storage key
export const AUTH_TOKEN_KEY = 'omnisight_auth_token';

// Refresh token storage key
export const REFRESH_TOKEN_KEY = 'omnisight_refresh_token';

// JWT token expiration time in milliseconds (15 minutes)
export const TOKEN_EXPIRATION_TIME = 15 * 60 * 1000;

// WebSocket connection URL
export const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:4000/ws';

// Camera stream settings
export const DEFAULT_STREAM_SETTINGS = {
  rtsp: {
    lowLatency: true,
    bufferTime: 300,
    reconnectInterval: 5000,
    timeout: 10000
  },
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ],
    offerOptions: {
      offerToReceiveVideo: true,
      offerToReceiveAudio: true
    }
  },
  hls: {
    lowLatencyMode: true,
    maxBufferLength: 30,
    maxMaxBufferLength: 60
  }
};

// Video player settings
export const VIDEO_PLAYER_SETTINGS = {
  autoplay: true,
  muted: true,
  controls: true,
  fluid: true,
  responsive: true,
  preload: 'auto'
};

// Video export settings
export const VIDEO_EXPORT_SETTINGS = {
  formats: ['mp4', 'mov', 'avi'],
  qualities: [
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' }
  ],
  defaultWatermark: {
    text: 'OmniSight',
    position: 'bottomRight',
    fontSize: 24,
    opacity: 0.7
  }
};

// Hardware acceleration settings
export const HARDWARE_ACCELERATION_SETTINGS = {
  enabled: true,
  preferredDevices: ['nvidia', 'amd', 'intel']
};

// Camera protocols
export const CAMERA_PROTOCOLS = [
  { id: 'rtsp', name: 'RTSP' },
  { id: 'onvif', name: 'ONVIF' },
  { id: 'hikvision', name: 'Hikvision' },
  { id: 'dahua', name: 'Dahua' },
  { id: 'axis', name: 'Axis' },
  { id: 'mjpeg', name: 'MJPEG' },
  { id: 'webrtc', name: 'WebRTC' },
  { id: 'hls', name: 'HLS' }
];

// Default pagination settings
export const PAGINATION_SETTINGS = {
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50, 100]
};