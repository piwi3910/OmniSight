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
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  Typography,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';
import MemoryIcon from '@mui/icons-material/Memory';
import DevicesIcon from '@mui/icons-material/Devices';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface HardwareDevice {
  id: string;
  name: string;
  type: 'gpu' | 'cpu' | 'tpu' | 'other';
  vendor: string;
  capabilities: string[];
  memory?: number;
  details?: Record<string, any>;
}

interface AccelerationProfile {
  id: string;
  name: string;
  description: string;
  deviceTypes: string[];
  settings: Record<string, any>;
}

interface AccelerationConfig {
  enabled: boolean;
  defaultDevice?: string;
  profiles: AccelerationProfile[];
}

interface BenchmarkResult {
  deviceId: string;
  deviceName: string;
  scores: {
    videoDecoding: number;
    videoEncoding: number;
    imageProcessing: number;
    inferenceSpeed: number;
    overall: number;
  };
  timestamp: string;
}

interface HardwareAccelerationSettingsProps {
  admin?: boolean;
  cameraId?: string;
  onChange?: (config: any) => void;
}

const HardwareAccelerationSettings: React.FC<HardwareAccelerationSettingsProps> = ({
  admin = false,
  cameraId,
  onChange
}) => {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [config, setConfig] = useState<AccelerationConfig>({ enabled: false, profiles: [] });
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // Fetch hardware devices and current configuration
  useEffect(() => {
    const fetchDevicesAndConfig = async () => {
      setLoading(true);
      try {
        // Get hardware devices
        const devicesResponse = await axios.get(`${API_BASE_URL}/protocols/hardware/devices`);
        setDevices(devicesResponse.data.devices);

        // Get acceleration config
        const configUrl = cameraId 
          ? `${API_BASE_URL}/protocols/hardware/cameras/${cameraId}/acceleration`
          : `${API_BASE_URL}/protocols/hardware/acceleration`;
        
        const configResponse = await axios.get(configUrl);
        setConfig(configResponse.data);
        
        if (configResponse.data.defaultDevice) {
          setSelectedDevice(configResponse.data.defaultDevice);
        } else if (devicesResponse.data.devices.length > 0) {
          setSelectedDevice(devicesResponse.data.devices[0].id);
        }
      } catch (error) {
        console.error('Error fetching hardware acceleration data:', error);
        enqueueSnackbar('Failed to load hardware acceleration settings', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchDevicesAndConfig();
  }, [cameraId, enqueueSnackbar]);

  // Handle enable/disable toggle
  const handleEnableToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    
    try {
      const updateUrl = cameraId 
        ? `${API_BASE_URL}/protocols/hardware/cameras/${cameraId}/acceleration`
        : `${API_BASE_URL}/protocols/hardware/acceleration`;
      
      const response = await axios.put(updateUrl, {
        ...config,
        enabled
      });
      
      setConfig(response.data);
      
      if (onChange) {
        onChange(response.data);
      }
      
      enqueueSnackbar(
        `Hardware acceleration ${enabled ? 'enabled' : 'disabled'} successfully`,
        { variant: 'success' }
      );
    } catch (error) {
      console.error('Error updating hardware acceleration settings:', error);
      enqueueSnackbar('Failed to update hardware acceleration settings', { variant: 'error' });
    }
  };

  // Handle device selection change
  const handleDeviceChange = async (event: SelectChangeEvent<string>) => {
    const deviceId = event.target.value;
    setSelectedDevice(deviceId);
    
    if (admin) {
      try {
        const updateUrl = cameraId 
          ? `${API_BASE_URL}/protocols/hardware/cameras/${cameraId}/acceleration`
          : `${API_BASE_URL}/protocols/hardware/acceleration`;
        
        const response = await axios.put(updateUrl, {
          ...config,
          defaultDevice: deviceId
        });
        
        setConfig(response.data);
        
        if (onChange) {
          onChange(response.data);
        }
        
        enqueueSnackbar('Default hardware device updated successfully', { variant: 'success' });
      } catch (error) {
        console.error('Error updating default hardware device:', error);
        enqueueSnackbar('Failed to update default hardware device', { variant: 'error' });
      }
    }
  };

  // Run benchmark on selected device
  const handleRunBenchmark = async () => {
    if (!selectedDevice) return;
    
    setBenchmarking(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/protocols/hardware/benchmark`, {
        deviceId: selectedDevice,
        testType: 'comprehensive'
      });
      
      setBenchmarkResults(response.data);
      enqueueSnackbar('Benchmark completed successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error running benchmark:', error);
      enqueueSnackbar('Failed to run hardware benchmark', { variant: 'error' });
    } finally {
      setBenchmarking(false);
    }
  };

  // Get device details by ID
  const getDeviceById = (id: string) => {
    return devices.find(device => device.id === id);
  };

  return (
    <Card>
      <CardHeader
        title="Hardware Acceleration"
        avatar={<MemoryIcon />}
        action={
          loading ? <CircularProgress size={24} /> : null
        }
      />
      <Divider />
      <CardContent>
        <Grid container spacing={3}>
          {/* Enable/Disable toggle */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.enabled}
                  onChange={handleEnableToggle}
                  disabled={loading || !admin}
                />
              }
              label={`Hardware Acceleration ${config.enabled ? 'Enabled' : 'Disabled'}`}
            />
            <Typography variant="body2" color="text.secondary">
              {config.enabled 
                ? 'Hardware acceleration is currently enabled for better performance'
                : 'Enable hardware acceleration to improve performance'}
            </Typography>
          </Grid>

          {/* Device selection */}
          <Grid item xs={12}>
            <FormControl fullWidth disabled={loading || !config.enabled}>
              <InputLabel id="device-select-label">Hardware Device</InputLabel>
              <Select
                labelId="device-select-label"
                id="device-select"
                value={selectedDevice}
                label="Hardware Device"
                onChange={handleDeviceChange}
                disabled={loading || !config.enabled || (!admin && !cameraId)}
              >
                {devices.map((device) => (
                  <MenuItem key={device.id} value={device.id}>
                    {device.name} ({device.vendor})
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Select hardware device for acceleration
              </FormHelperText>
            </FormControl>
          </Grid>

          {/* Device details */}
          {selectedDevice && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  <DevicesIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Device Details
                </Typography>
                
                {getDeviceById(selectedDevice) && (
                  <Box>
                    <Typography variant="body2">
                      <strong>Name:</strong> {getDeviceById(selectedDevice)?.name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Vendor:</strong> {getDeviceById(selectedDevice)?.vendor}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Type:</strong> {getDeviceById(selectedDevice)?.type.toUpperCase()}
                    </Typography>
                    {getDeviceById(selectedDevice)?.memory && (
                      <Typography variant="body2">
                        <strong>Memory:</strong> {getDeviceById(selectedDevice)?.memory} MB
                      </Typography>
                    )}
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Capabilities:</strong>
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {getDeviceById(selectedDevice)?.capabilities.map((cap) => (
                          <Chip
                            key={cap}
                            label={cap}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>
          )}

          {/* Benchmark button */}
          <Grid item xs={12}>
            <Button
              variant="outlined"
              startIcon={benchmarking ? <CircularProgress size={24} /> : <SpeedIcon />}
              onClick={handleRunBenchmark}
              disabled={benchmarking || !selectedDevice || !config.enabled}
              fullWidth
            >
              {benchmarking ? 'Running Benchmark...' : 'Run Performance Benchmark'}
            </Button>
          </Grid>

          {/* Benchmark results */}
          {benchmarkResults && (
            <Grid item xs={12}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Benchmark</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell>Rating</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Video Decoding</TableCell>
                      <TableCell align="right">{benchmarkResults.scores.videoDecoding}</TableCell>
                      <TableCell>
                        {getRatingChip(benchmarkResults.scores.videoDecoding)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Video Encoding</TableCell>
                      <TableCell align="right">{benchmarkResults.scores.videoEncoding}</TableCell>
                      <TableCell>
                        {getRatingChip(benchmarkResults.scores.videoEncoding)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Image Processing</TableCell>
                      <TableCell align="right">{benchmarkResults.scores.imageProcessing}</TableCell>
                      <TableCell>
                        {getRatingChip(benchmarkResults.scores.imageProcessing)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Inference Speed</TableCell>
                      <TableCell align="right">{benchmarkResults.scores.inferenceSpeed}</TableCell>
                      <TableCell>
                        {getRatingChip(benchmarkResults.scores.inferenceSpeed)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Overall Performance</strong></TableCell>
                      <TableCell align="right"><strong>{benchmarkResults.scores.overall}</strong></TableCell>
                      <TableCell>
                        {getRatingChip(benchmarkResults.scores.overall)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary">
                Benchmark performed on {new Date(benchmarkResults.timestamp).toLocaleString()}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

// Helper function to get rating chip based on score
const getRatingChip = (score: number) => {
  if (score >= 8) {
    return <Chip label="Excellent" size="small" color="success" />;
  } else if (score >= 6) {
    return <Chip label="Good" size="small" color="primary" />;
  } else if (score >= 4) {
    return <Chip label="Average" size="small" color="info" />;
  } else if (score >= 2) {
    return <Chip label="Poor" size="small" color="warning" />;
  } else {
    return <Chip label="Very Poor" size="small" color="error" />;
  }
};

export default HardwareAccelerationSettings;