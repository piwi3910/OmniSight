import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface CameraProtocolSettingsProps {
  cameraId: string;
  onUpdate?: () => void;
}

interface CameraCapabilities {
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
}

const protocolOptions = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'rtsp', label: 'RTSP (Generic)' },
  { value: 'onvif', label: 'ONVIF' },
  { value: 'hikvision', label: 'Hikvision' },
  { value: 'dahua', label: 'Dahua' },
  { value: 'axis', label: 'Axis' },
  { value: 'unifi', label: 'Ubiquiti UniFi' },
  { value: 'hanwha', label: 'Hanwha (Samsung)' },
];

const CameraProtocolSettings: React.FC<CameraProtocolSettingsProps> = ({ cameraId, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [camera, setCamera] = useState<any>(null);
  const [protocol, setProtocol] = useState('');
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const [detectedInfo, setDetectedInfo] = useState<any>(null);
  const { enqueueSnackbar } = useSnackbar();

  // Fetch camera details on component mount
  useEffect(() => {
    const fetchCamera = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/cameras/${cameraId}`);
        setCamera(response.data);
        setProtocol(response.data.protocolType || 'auto');
        
        if (response.data.settings?.capabilities) {
          setCapabilities(response.data.settings.capabilities);
        }
      } catch (error) {
        enqueueSnackbar('Failed to fetch camera details', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchCamera();
  }, [cameraId, enqueueSnackbar]);

  // Handle protocol change
  const handleProtocolChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setProtocol(event.target.value as string);
  };

  // Detect protocol automatically
  const handleDetectProtocol = async () => {
    setDetecting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/cameras/${cameraId}/detect-protocol`);
      
      setDetectedInfo(response.data);
      setProtocol(response.data.protocol);
      
      enqueueSnackbar(`Detected ${response.data.name} protocol`, { variant: 'success' });
      
      // After protocol detection, fetch capabilities
      await fetchCapabilities();
      
      // Trigger parent update if provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      enqueueSnackbar('Failed to detect protocol', { variant: 'error' });
    } finally {
      setDetecting(false);
    }
  };

  // Fetch camera capabilities
  const fetchCapabilities = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cameras/${cameraId}/capabilities`);
      setCapabilities(response.data.capabilities);
    } catch (error) {
      enqueueSnackbar('Failed to fetch camera capabilities', { variant: 'error' });
    }
  };

  // Test connection with current settings
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await axios.post(`${API_BASE_URL}/cameras/${cameraId}/test-connection`);
      enqueueSnackbar('Connection successful', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Connection failed', { variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  // Save protocol settings
  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_BASE_URL}/cameras/${cameraId}`, {
        protocolType: protocol === 'auto' ? detectedInfo?.protocol || null : protocol
      });
      
      enqueueSnackbar('Protocol settings saved', { variant: 'success' });
      
      // Trigger parent update if provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      enqueueSnackbar('Failed to save protocol settings', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !camera) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardHeader 
        title="Camera Protocol Settings" 
        subheader="Configure protocol-specific settings for this camera"
        action={
          <IconButton onClick={fetchCapabilities} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel id="protocol-select-label">Camera Protocol</InputLabel>
              <Select
                labelId="protocol-select-label"
                id="protocol-select"
                value={protocol}
                label="Camera Protocol"
                onChange={handleProtocolChange}
                disabled={detecting}
              >
                {protocolOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Select the protocol to use for camera communication
              </FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={handleDetectProtocol}
                startIcon={detecting ? <CircularProgress size={20} /> : <SettingsIcon />}
                disabled={detecting}
              >
                Auto Detect Protocol
              </Button>
              <Button 
                variant="outlined" 
                color="secondary" 
                onClick={handleTestConnection}
                startIcon={testing ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                disabled={testing || !protocol || protocol === 'auto'}
              >
                Test Connection
              </Button>
            </Box>
          </Grid>

          {detectedInfo && (
            <Grid item xs={12}>
              <Box p={2} bgcolor="rgba(0, 0, 0, 0.03)" borderRadius={1}>
                <Typography variant="subtitle1" gutterBottom>
                  <strong>Detected Protocol Information</strong>
                </Typography>
                <Typography variant="body2">
                  <strong>Protocol:</strong> {detectedInfo.name}
                </Typography>
                <Typography variant="body2">
                  <strong>Model:</strong> {detectedInfo.model || 'Unknown'}
                </Typography>
                <Typography variant="body2">
                  <strong>Manufacturer:</strong> {detectedInfo.manufacturer || 'Unknown'}
                </Typography>
              </Box>
            </Grid>
          )}
          
          {capabilities && (
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Camera Capabilities</strong>
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                {Object.entries(capabilities).map(([key, value]) => (
                  value ? (
                    <Chip 
                      key={key} 
                      label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} 
                      color="primary" 
                      size="small" 
                      icon={<CheckCircleIcon />} 
                    />
                  ) : null
                ))}
              </Box>
            </Grid>
          )}

          <Grid item xs={12}>
            <Box display="flex" justifyContent="flex-end">
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleSaveSettings}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : null}
              >
                Save Settings
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default CameraProtocolSettings;