import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  InputLabel,
  Slider,
  Grid,
  Divider,
  Chip,
  CircularProgress,
  Button,
  Alert,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Speed as SpeedIcon,
  BatteryChargingFull as BatteryIcon,
  Settings as SettingsIcon,
  Memory as MemoryIcon,
  SaveAlt as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// Define types for acceleration settings and info
interface AccelerationInfo {
  enabled: boolean;
  availablePlatforms: string[];
  activePlatforms: {
    inference: string;
    imageProcessing: string;
  };
  deviceInfo: Array<{
    deviceId: string;
    platform: string;
    deviceName: string;
    memoryTotal: number;
    memoryFree: number;
    utilization: number;
    capabilities: string[];
  }>;
  perfPowerBalance: number;
}

interface AccelerationSettings {
  enabled: boolean;
  preferredPlatform: string | null;
  inferencePlatform: string | null;
  imageProcessingPlatform: string | null;
  perfPowerBalance: number;
}

interface ModelInfo {
  path: string;
  type: string;
  classes: number;
  taskTypes: string[];
}

const HardwareAccelerationSettings: React.FC = () => {
  const { token } = useAuth();
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  
  // State for hardware acceleration data
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSetError] = useState<string | null>(null);
  
  // State for hardware acceleration info
  const [accelerationInfo, setAccelerationInfo] = useState<AccelerationInfo | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [stats, setStats] = useState<{ detectionCount: number; processingCount: number } | null>(null);
  
  // State for settings that can be modified
  const [settings, setSettings] = useState<AccelerationSettings>({
    enabled: true,
    preferredPlatform: null,
    inferencePlatform: null,
    imageProcessingPlatform: null,
    perfPowerBalance: 0.5
  });
  
  // Get hardware acceleration info
  const fetchAccelerationInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/detection/hardware/acceleration`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const { acceleration, model, detectionCount, processingCount } = response.data.data;
      
      setAccelerationInfo(acceleration);
      setModelInfo(model);
      setStats({ detectionCount, processingCount });
      
      // Update settings from acceleration info
      setSettings({
        enabled: acceleration.enabled,
        preferredPlatform: null, // This might not be returned in the API
        inferencePlatform: acceleration.activePlatforms.inference,
        imageProcessingPlatform: acceleration.activePlatforms.imageProcessing,
        perfPowerBalance: acceleration.perfPowerBalance
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching hardware acceleration info:', err);
      setError('Failed to load hardware acceleration information. Please try again later.');
      setLoading(false);
    }
  };
  
  // Save settings
  const saveSettings = async () => {
    setLoading(true);
    setSaveSuccess(false);
    setSetError(null);
    
    try {
      await axios.post(`${API_URL}/detection/hardware/acceleration`, settings, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setSaveSuccess(true);
      setLoading(false);
      
      // Refresh data after save
      fetchAccelerationInfo();
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving hardware acceleration settings:', err);
      setSetError('Failed to save settings. Please try again later.');
      setLoading(false);
    }
  };
  
  // Load data on component mount
  useEffect(() => {
    fetchAccelerationInfo();
  }, [token, API_URL]);
  
  // Format memory size to readable format
  const formatMemory = (memoryMB: number): string => {
    if (memoryMB >= 1024) {
      return `${(memoryMB / 1024).toFixed(1)} GB`;
    }
    return `${memoryMB} MB`;
  };
  
  // Render platform chip with appropriate color
  const renderPlatformChip = (platform: string) => {
    let color: "primary" | "secondary" | "error" | "info" | "success" | "warning" | "default" = "default";
    
    if (platform.includes('NVIDIA')) {
      color = 'success';
    } else if (platform.includes('INTEL')) {
      color = 'primary';
    } else if (platform.includes('AMD')) {
      color = 'error';
    } else if (platform === 'CPU') {
      color = 'default';
    }
    
    return <Chip label={platform} color={color} size="small" />;
  };
  
  // Render loading state
  if (loading && !accelerationInfo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Hardware acceleration settings saved successfully!
        </Alert>
      )}
      
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Hardware Acceleration Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Hardware Acceleration Status
                </Typography>
                <Button
                  startIcon={<RefreshIcon />}
                  variant="outlined"
                  size="small"
                  onClick={fetchAccelerationInfo}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Box>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                    color="primary"
                  />
                }
                label={settings.enabled ? "Hardware Acceleration Enabled" : "Hardware Acceleration Disabled"}
              />
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Available Platforms:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {accelerationInfo?.availablePlatforms.map((platform) => (
                    renderPlatformChip(platform)
                  ))}
                </Stack>
              </Box>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Active Platforms:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="body2" color="textSecondary">
                        Inference:
                      </Typography>
                      {renderPlatformChip(accelerationInfo?.activePlatforms.inference || 'CPU')}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="body2" color="textSecondary">
                        Image Processing:
                      </Typography>
                      {renderPlatformChip(accelerationInfo?.activePlatforms.imageProcessing || 'CPU')}
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Performance Statistics:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Detected Objects:
                    </Typography>
                    <Typography variant="body1">
                      {stats?.detectionCount.toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">
                      Processed Frames:
                    </Typography>
                    <Typography variant="body1">
                      {stats?.processingCount.toLocaleString()}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Available Devices */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Available Accelerator Devices
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Device</TableCell>
                      <TableCell>Platform</TableCell>
                      <TableCell>Memory</TableCell>
                      <TableCell>Utilization</TableCell>
                      <TableCell>Capabilities</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {accelerationInfo?.deviceInfo.map((device) => (
                      <TableRow key={device.deviceId}>
                        <TableCell>
                          <Typography variant="body2">
                            {device.deviceName}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {device.deviceId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {renderPlatformChip(device.platform)}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatMemory(device.memoryFree)} free
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Total: {formatMemory(device.memoryTotal)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {(device.utilization * 100).toFixed(1)}%
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {device.capabilities.map((cap) => (
                              <Chip key={cap} label={cap} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Hardware Acceleration Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Hardware Acceleration Settings
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel id="inference-platform-label">Inference Platform</InputLabel>
                    <Select
                      labelId="inference-platform-label"
                      value={settings.inferencePlatform || ''}
                      label="Inference Platform"
                      onChange={(e) => setSettings({ ...settings, inferencePlatform: e.target.value })}
                      disabled={!settings.enabled}
                    >
                      <MenuItem value="">
                        <em>Auto (System Default)</em>
                      </MenuItem>
                      {accelerationInfo?.availablePlatforms.map((platform) => (
                        <MenuItem key={platform} value={platform}>
                          {platform}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel id="image-processing-platform-label">Image Processing Platform</InputLabel>
                    <Select
                      labelId="image-processing-platform-label"
                      value={settings.imageProcessingPlatform || ''}
                      label="Image Processing Platform"
                      onChange={(e) => setSettings({ ...settings, imageProcessingPlatform: e.target.value })}
                      disabled={!settings.enabled}
                    >
                      <MenuItem value="">
                        <em>Auto (System Default)</em>
                      </MenuItem>
                      {accelerationInfo?.availablePlatforms.map((platform) => (
                        <MenuItem key={platform} value={platform}>
                          {platform}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography id="perf-power-balance-slider" gutterBottom>
                        Performance vs. Power Efficiency
                      </Typography>
                    </Box>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item>
                        <BatteryIcon color="success" />
                      </Grid>
                      <Grid item xs>
                        <Slider
                          value={settings.perfPowerBalance * 100}
                          onChange={(_, newValue) => setSettings({ 
                            ...settings, 
                            perfPowerBalance: (newValue as number) / 100 
                          })}
                          aria-labelledby="perf-power-balance-slider"
                          disabled={!settings.enabled}
                          marks={[
                            {
                              value: 0,
                              label: 'Power',
                            },
                            {
                              value: 50,
                              label: 'Balanced',
                            },
                            {
                              value: 100,
                              label: 'Performance',
                            },
                          ]}
                        />
                      </Grid>
                      <Grid item>
                        <SpeedIcon color="error" />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={saveSettings}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Model Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Detection Model Information
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">Model Type</TableCell>
                      <TableCell>{modelInfo?.type}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Model Path</TableCell>
                      <TableCell>{modelInfo?.path}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Number of Classes</TableCell>
                      <TableCell>{modelInfo?.classes}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">Task Types</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          {modelInfo?.taskTypes.map((task) => (
                            <Chip key={task} label={task} size="small" />
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default HardwareAccelerationSettings;