import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Slider,
  Typography,
  Grid,
  Stack
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';
import axios from 'axios';
import { API_BASE_URL, DEFAULT_STREAM_SETTINGS } from '../config';

interface WebRTCPlayerProps {
  cameraId: string;
  streamId?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  width?: string | number;
  height?: string | number;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  className?: string;
  style?: React.CSSProperties;
}

interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface StreamStats {
  bitrate: number;
  framerate: number;
  packetLoss: number;
  resolution: string;
  latency: number;
}

interface SessionInfo {
  sessionId: string;
  offer: RTCSessionDescriptionInit;
}

const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({
  cameraId,
  streamId = 'primary',
  autoPlay = true,
  muted = true,
  controls = true,
  width = '100%',
  height = 'auto',
  onError,
  onStatusChange,
  className,
  style
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientId = useRef<string>(`client-${Math.random().toString(36).substring(2, 9)}`);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  const [iceServers, setIceServers] = useState<ICEServer[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [quality, setQuality] = useState<'auto' | 'high' | 'medium' | 'low'>('auto');
  const [loading, setLoading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(!muted);
  const [statsVisible, setStatsVisible] = useState(false);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [statsInterval, setStatsIntervalRef] = useState<NodeJS.Timeout | null>(null);

  // Fetch ICE servers on component mount
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/streams/webrtc/ice-servers`);
        setIceServers(response.data.iceServers);
      } catch (error) {
        console.error('Error fetching ICE servers:', error);
        if (onError) onError('Failed to fetch ICE servers');
      }
    };

    fetchIceServers();
  }, [onError]);

  // Initialize WebRTC connection
  useEffect(() => {
    if (cameraId && iceServers.length > 0) {
      connectToStream();
    }

    // Clean up on unmount
    return () => {
      disconnectFromStream();
      
      if (statsInterval) {
        clearInterval(statsInterval);
      }
    };
  }, [cameraId, iceServers]);

  // Handle status changes
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(connectionStatus);
    }
  }, [connectionStatus, onStatusChange]);

  // Connect to WebRTC stream
  const connectToStream = async () => {
    try {
      setLoading(true);
      setConnectionStatus('connecting');

      // Close existing connection if any
      if (peerConnection.current) {
        disconnectFromStream();
      }

      // Create a new peer connection
      peerConnection.current = new RTCPeerConnection({
        iceServers
      });

      // Set up data channel
      peerConnection.current.ondatachannel = (event) => {
        dataChannel.current = event.channel;
        setupDataChannel();
      };

      // Set up event handlers
      setupPeerConnectionEvents();

      // Create an offer
      const response = await axios.post(`${API_BASE_URL}/streams/webrtc/offer`, {
        cameraId,
        streamId,
        clientId: clientId.current,
        options: getStreamOptions()
      });

      const sessionInfo: SessionInfo = response.data;
      setSessionId(sessionInfo.sessionId);

      // Set remote description (the offer)
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(sessionInfo.offer)
      );

      // Create answer
      const answer = await peerConnection.current.createAnswer();
      
      // Set local description
      await peerConnection.current.setLocalDescription(answer);

      // Send answer to signaling server
      await axios.post(`${API_BASE_URL}/streams/webrtc/answer`, {
        sessionId: sessionInfo.sessionId,
        answer
      });

      // Start stats polling
      startStatsPolling(sessionInfo.sessionId);

    } catch (error) {
      console.error('Error connecting to WebRTC stream:', error);
      setConnectionStatus('error');
      if (onError) onError('Failed to connect to stream');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect from WebRTC stream
  const disconnectFromStream = async () => {
    // Stop stats polling
    if (statsInterval) {
      clearInterval(statsInterval);
      setStatsIntervalRef(null);
    }

    // Close session on server
    if (sessionId) {
      try {
        await axios.delete(`${API_BASE_URL}/streams/webrtc/sessions/${sessionId}`);
      } catch (error) {
        console.error('Error closing WebRTC session:', error);
      }
    }

    // Close data channel
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }

    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      videoRef.current.srcObject = null;
    }

    setConnectionStatus('disconnected');
    setSessionId(null);
    setStreamStats(null);
  };

  // Set up peer connection event handlers
  const setupPeerConnectionEvents = () => {
    if (!peerConnection.current) return;

    peerConnection.current.onicecandidate = async (event) => {
      if (event.candidate && sessionId) {
        try {
          await axios.post(`${API_BASE_URL}/streams/webrtc/ice-candidate`, {
            sessionId,
            candidate: event.candidate
          });
        } catch (error) {
          console.error('Error sending ICE candidate:', error);
        }
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (videoRef.current && event.streams && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        
        if (autoPlay) {
          videoRef.current.play().catch(error => {
            console.error('Error playing video:', error);
          });
        }
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      if (!peerConnection.current) return;

      console.log('Connection state changed:', peerConnection.current.connectionState);
      
      switch (peerConnection.current.connectionState) {
        case 'connected':
          setConnectionStatus('connected');
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          setConnectionStatus('disconnected');
          break;
      }
    };

    peerConnection.current.onicecandidateerror = (event) => {
      console.error('ICE candidate error:', event);
    };
  };

  // Set up data channel event handlers
  const setupDataChannel = () => {
    if (!dataChannel.current) return;

    dataChannel.current.onopen = () => {
      console.log('Data channel opened');
    };

    dataChannel.current.onclose = () => {
      console.log('Data channel closed');
    };

    dataChannel.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'stats') {
          // Handle stats update from server
          updateStats(message.data);
        } else if (message.type === 'error') {
          // Handle error from server
          console.error('Server error:', message.error);
          if (onError) onError(message.error);
        }
      } catch (error) {
        console.error('Error parsing data channel message:', error);
      }
    };
  };

  // Get stream options based on quality setting
  const getStreamOptions = () => {
    switch (quality) {
      case 'high':
        return {
          ...DEFAULT_STREAM_SETTINGS.webrtc,
          maxBitrate: 2000,
          maxFrameRate: 30,
          resolution: { width: 1280, height: 720 }
        };
      case 'medium':
        return {
          ...DEFAULT_STREAM_SETTINGS.webrtc,
          maxBitrate: 1000,
          maxFrameRate: 25,
          resolution: { width: 854, height: 480 }
        };
      case 'low':
        return {
          ...DEFAULT_STREAM_SETTINGS.webrtc,
          maxBitrate: 500,
          maxFrameRate: 15,
          resolution: { width: 640, height: 360 }
        };
      default:
        return DEFAULT_STREAM_SETTINGS.webrtc;
    }
  };

  // Update stream configuration
  const updateStreamConfig = async () => {
    if (!sessionId) return;

    try {
      await axios.put(`${API_BASE_URL}/streams/webrtc/sessions/${sessionId}/config`, {
        config: getStreamOptions()
      });
    } catch (error) {
      console.error('Error updating stream config:', error);
    }
  };

  // Handle quality change
  const handleQualityChange = (event: SelectChangeEvent<string>) => {
    setQuality(event.target.value as 'auto' | 'high' | 'medium' | 'low');
    
    // Update stream configuration
    updateStreamConfig();
  };

  // Handle audio toggle
  const handleAudioToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !audioEnabled;
      setAudioEnabled(!audioEnabled);
    }
  };

  // Poll for stream statistics
  const startStatsPolling = (sessionId: string) => {
    // Clear existing interval if any
    if (statsInterval) {
      clearInterval(statsInterval);
    }

    // Start new polling interval
    const interval = setInterval(async () => {
      if (connectionStatus !== 'connected') return;

      try {
        const response = await axios.get(`${API_BASE_URL}/streams/webrtc/sessions/${sessionId}/stats`);
        updateStats(response.data);
      } catch (error) {
        console.error('Error fetching stream stats:', error);
      }
    }, 2000);

    setStatsIntervalRef(interval);
  };

  // Update stream statistics
  const updateStats = (stats: any) => {
    setStreamStats({
      bitrate: stats.bitrate || 0,
      framerate: stats.framerate || 0,
      packetLoss: stats.packetsLost || 0,
      resolution: '1280x720', // This would come from actual stats
      latency: stats.currentRoundTripTime ? stats.currentRoundTripTime * 1000 : 0
    });
  };

  return (
    <Box 
      className={className}
      style={style}
      sx={{ position: 'relative', width, height }}
    >
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />

      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}
        >
          <CircularProgress color="primary" />
        </Box>
      )}

      {controls && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={connectionStatus === 'connected' ? disconnectFromStream : connectToStream}
              startIcon={connectionStatus === 'connected' ? <VideocamIcon /> : <VideocamOffIcon />}
            >
              {connectionStatus === 'connected' ? 'Disconnect' : 'Connect'}
            </Button>

            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={handleAudioToggle}
              startIcon={audioEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            >
              {audioEnabled ? 'Mute' : 'Unmute'}
            </Button>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={() => setStatsVisible(!statsVisible)}
              startIcon={<SpeedIcon />}
            >
              Stats
            </Button>

            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={quality}
                onChange={handleQualityChange}
                displayEmpty
                variant="standard"
                sx={{ color: 'white' }}
              >
                <MenuItem value="auto">Auto</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Box>
      )}

      {statsVisible && streamStats && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            fontSize: '0.75rem'
          }}
        >
          <Typography variant="caption" component="div">
            Bitrate: {streamStats.bitrate} Kbps
          </Typography>
          <Typography variant="caption" component="div">
            Framerate: {streamStats.framerate} fps
          </Typography>
          <Typography variant="caption" component="div">
            Resolution: {streamStats.resolution}
          </Typography>
          <Typography variant="caption" component="div">
            Packet Loss: {streamStats.packetLoss}
          </Typography>
          <Typography variant="caption" component="div">
            Latency: {streamStats.latency.toFixed(0)} ms
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default WebRTCPlayer;