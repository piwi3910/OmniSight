import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Alert,
  AlertTitle
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface ONVIFCamera {
  id: string;
  address: string;
  port: number;
  manufacturer: string;
  model: string;
  firmwareVersion?: string;
  serialNumber?: string;
  profiles?: ONVIFProfile[];
  hasCredentials: boolean;
}

interface ONVIFProfile {
  name: string;
  token: string;
  resolution: { width: number; height: number };
  encoding: string;
  fps: number;
  streamUri?: string;
}

interface ONVIFCredentials {
  username: string;
  password: string;
}

interface ONVIFDiscoveryProps {
  onCameraAdd?: (camera: ONVIFCamera) => void;
  showOnlyNew?: boolean;
  networkInterface?: string;
}

const ONVIFDiscovery: React.FC<ONVIFDiscoveryProps> = ({
  onCameraAdd,
  showOnlyNew = false,
  networkInterface
}) => {
  const [discoveredCameras, setDiscoveredCameras] = useState<ONVIFCamera[]>([]);
  const [existingCameras, setExistingCameras] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [fetchingProfiles, setFetchingProfiles] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [customIpAddress, setCustomIpAddress] = useState('');
  const [customPort, setCustomPort] = useState('80');
  const [selectedIpRange, setSelectedIpRange] = useState('');
  const [ipRanges, setIpRanges] = useState<string[]>([]);
  const [interfaces, setInterfaces] = useState<{ name: string; address: string; netmask: string; }[]>([]);
  const [selectedInterface, setSelectedInterface] = useState(networkInterface || '');
  const [scanError, setScanError] = useState<string | null>(null);
  
  // Credentials dialog
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<ONVIFCamera | null>(null);
  const [credentials, setCredentials] = useState<ONVIFCredentials>({ username: '', password: '' });
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [savingCredentials, setSavingCredentials] = useState(false);
  
  // Camera details dialog
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedCameraDetails, setSelectedCameraDetails] = useState<ONVIFCamera | null>(null);

  // Fetch network interfaces and existing cameras on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch network interfaces
        const interfacesResponse = await axios.get(`${API_BASE_URL}/protocols/onvif/interfaces`);
        setInterfaces(interfacesResponse.data);
        
        if (interfacesResponse.data.length > 0 && !selectedInterface) {
          setSelectedInterface(interfacesResponse.data[0].name);
          
          // Generate IP range suggestions
          const primaryInterface = interfacesResponse.data[0];
          const ipRanges = generateIpRanges(primaryInterface.address, primaryInterface.netmask);
          setIpRanges(ipRanges);
          if (ipRanges.length > 0) {
            setSelectedIpRange(ipRanges[0]);
          }
        }
        
        // Fetch existing cameras
        const camerasResponse = await axios.get(`${API_BASE_URL}/cameras`);
        const existingOnvifCameras = camerasResponse.data
          .filter((camera: any) => camera.protocolType === 'onvif')
          .map((camera: any) => `${camera.host}:${camera.port}`);
        
        setExistingCameras(existingOnvifCameras);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    
    fetchData();
  }, [networkInterface]);

  // Generate IP range suggestions based on interface address and netmask
  const generateIpRanges = (address: string, netmask: string) => {
    // Simple implementation just for demonstration
    // In a real implementation, this would calculate appropriate ranges based on the netmask
    const parts = address.split('.');
    return [
      `${parts[0]}.${parts[1]}.${parts[2]}.1-${parts[0]}.${parts[1]}.${parts[2]}.254`,
      `${parts[0]}.${parts[1]}.0.1-${parts[0]}.${parts[1]}.255.254`
    ];
  };

  // Start network scan for ONVIF devices
  const startNetworkScan = async () => {
    try {
      setScanning(true);
      setScanProgress(0);
      setScanError(null);
      setDiscoveredCameras([]);
      
      // Get IP range to scan based on selection or default to the whole subnet
      const range = selectedIpRange || `${selectedInterface}-subnet`;
      
      // Start scan
      const response = await axios.post(`${API_BASE_URL}/protocols/onvif/discover`, {
        interface: selectedInterface,
        range: range
      });
      
      // Set up progress monitoring
      const scanId = response.data.scanId;
      const progressInterval = setInterval(async () => {
        try {
          const progressResponse = await axios.get(`${API_BASE_URL}/protocols/onvif/discover/${scanId}`);
          
          setScanProgress(progressResponse.data.progress);
          
          if (progressResponse.data.complete) {
            clearInterval(progressInterval);
            setScanning(false);
            setScanProgress(100);
            
            // Filter out existing cameras if requested
            let cameras = progressResponse.data.devices;
            if (showOnlyNew) {
              cameras = cameras.filter((camera: ONVIFCamera) => 
                !existingCameras.includes(`${camera.address}:${camera.port}`)
              );
            }
            
            setDiscoveredCameras(cameras);
          }
        } catch (error) {
          clearInterval(progressInterval);
          setScanning(false);
          setScanError('Error monitoring scan progress');
          console.error('Error monitoring scan progress:', error);
        }
      }, 1000);
      
    } catch (error) {
      setScanning(false);
      setScanError('Failed to start network scan');
      console.error('Error starting network scan:', error);
    }
  };

  // Try to detect a single camera at a specific IP address
  const detectSingleCamera = async () => {
    if (!customIpAddress) {
      setScanError('Please enter an IP address');
      return;
    }
    
    try {
      setScanning(true);
      setScanProgress(0);
      setScanError(null);
      
      const response = await axios.post(`${API_BASE_URL}/protocols/onvif/detect`, {
        address: customIpAddress,
        port: parseInt(customPort)
      });
      
      setScanning(false);
      setScanProgress(100);
      
      if (response.data) {
        // Check if it should be filtered out
        if (showOnlyNew && existingCameras.includes(`${response.data.address}:${response.data.port}`)) {
          setDiscoveredCameras([]);
          setScanError('This camera is already in your system');
        } else {
          setDiscoveredCameras([response.data]);
        }
      } else {
        setDiscoveredCameras([]);
        setScanError('No ONVIF camera found at this address');
      }
      
    } catch (error) {
      setScanning(false);
      setScanError('Failed to detect camera');
      console.error('Error detecting camera:', error);
    }
  };

  // Fetch profiles for a camera
  const fetchCameraProfiles = async (camera: ONVIFCamera) => {
    if (!camera.hasCredentials) {
      setSelectedCamera(camera);
      setCredentialsDialogOpen(true);
      return;
    }
    
    try {
      setFetchingProfiles(camera.id);
      
      const response = await axios.get(`${API_BASE_URL}/protocols/onvif/${camera.id}/profiles`);
      
      // Update the camera with profiles
      const updatedCameras = discoveredCameras.map(c => {
        if (c.id === camera.id) {
          return { ...c, profiles: response.data.profiles };
        }
        return c;
      });
      
      setDiscoveredCameras(updatedCameras);
      
      // Show camera details
      const updatedCamera = updatedCameras.find(c => c.id === camera.id);
      if (updatedCamera) {
        setSelectedCameraDetails(updatedCamera);
        setDetailsDialogOpen(true);
      }
      
    } catch (error) {
      console.error('Error fetching camera profiles:', error);
      setScanError(`Failed to fetch profiles for ${camera.address}`);
    } finally {
      setFetchingProfiles(null);
    }
  };

  // Handle adding credentials for a camera
  const handleCredentialsSubmit = async () => {
    if (!selectedCamera) return;
    
    if (!credentials.username || !credentials.password) {
      setCredentialsError('Username and password are required');
      return;
    }
    
    try {
      setSavingCredentials(true);
      setCredentialsError(null);
      
      const response = await axios.post(`${API_BASE_URL}/protocols/onvif/${selectedCamera.id}/credentials`, {
        username: credentials.username,
        password: credentials.password
      });
      
      // Update the camera with hasCredentials flag
      const updatedCameras = discoveredCameras.map(c => {
        if (c.id === selectedCamera.id) {
          return { ...c, hasCredentials: true };
        }
        return c;
      });
      
      setDiscoveredCameras(updatedCameras);
      setCredentialsDialogOpen(false);
      
      // Now fetch profiles with the new credentials
      const updatedCamera = updatedCameras.find(c => c.id === selectedCamera.id);
      if (updatedCamera) {
        fetchCameraProfiles(updatedCamera);
      }
      
    } catch (error) {
      console.error('Error saving credentials:', error);
      setCredentialsError('Invalid credentials or connection failed');
    } finally {
      setSavingCredentials(false);
    }
  };

  // Add a camera to the system
  const addCamera = async (camera: ONVIFCamera) => {
    if (!camera.hasCredentials) {
      setSelectedCamera(camera);
      setCredentialsDialogOpen(true);
      return;
    }
    
    try {
      const response = await axios.post(`${API_BASE_URL}/cameras`, {
        name: `${camera.manufacturer} ${camera.model}`,
        host: camera.address,
        port: camera.port,
        protocolType: 'onvif',
        username: credentials.username,
        password: credentials.password,
        settings: {
          serialNumber: camera.serialNumber,
          manufacturer: camera.manufacturer,
          model: camera.model,
          firmwareVersion: camera.firmwareVersion
        }
      });
      
      // Filter out the added camera
      const updatedCameras = discoveredCameras.filter(c => c.id !== camera.id);
      setDiscoveredCameras(updatedCameras);
      
      // Add to existing cameras list
      setExistingCameras([...existingCameras, `${camera.address}:${camera.port}`]);
      
      // Call onCameraAdd callback if provided
      if (onCameraAdd) {
        onCameraAdd(camera);
      }
      
    } catch (error) {
      console.error('Error adding camera:', error);
      setScanError(`Failed to add camera ${camera.address}`);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          <NetworkCheckIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          ONVIF Camera Discovery
        </Typography>
        
        <Grid container spacing={3}>
          {/* Network Scan Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Network Scan
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="interface-select-label">Network Interface</InputLabel>
                    <Select
                      labelId="interface-select-label"
                      value={selectedInterface}
                      label="Network Interface"
                      onChange={(e) => setSelectedInterface(e.target.value)}
                      disabled={scanning}
                    >
                      {interfaces.map((iface) => (
                        <MenuItem key={iface.name} value={iface.name}>
                          {iface.name} ({iface.address})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="ip-range-select-label">IP Range</InputLabel>
                    <Select
                      labelId="ip-range-select-label"
                      value={selectedIpRange}
                      label="IP Range"
                      onChange={(e) => setSelectedIpRange(e.target.value)}
                      disabled={scanning}
                    >
                      {ipRanges.map((range) => (
                        <MenuItem key={range} value={range}>
                          {range}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={scanning ? <CircularProgress size={24} color="inherit" /> : <SearchIcon />}
                    onClick={startNetworkScan}
                    disabled={scanning || !selectedInterface}
                    fullWidth
                  >
                    {scanning ? `Scanning (${scanProgress}%)` : 'Scan Network'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          
          {/* Direct Detection Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Direct Detection
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="IP Address"
                    fullWidth
                    value={customIpAddress}
                    onChange={(e) => setCustomIpAddress(e.target.value)}
                    disabled={scanning}
                    placeholder="e.g., 192.168.1.100"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Port"
                    fullWidth
                    value={customPort}
                    onChange={(e) => setCustomPort(e.target.value)}
                    disabled={scanning}
                    placeholder="80"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={scanning ? <CircularProgress size={24} color="inherit" /> : <VideocamIcon />}
                    onClick={detectSingleCamera}
                    disabled={scanning || !customIpAddress}
                    fullWidth
                  >
                    Detect Camera
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          
          {/* Error Alert */}
          {scanError && (
            <Grid item xs={12}>
              <Alert severity="error" onClose={() => setScanError(null)}>
                <AlertTitle>Error</AlertTitle>
                {scanError}
              </Alert>
            </Grid>
          )}
          
          {/* Results Section */}
          <Grid item xs={12}>
            <Paper sx={{ p: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
                <Typography variant="h6">
                  Discovered Cameras ({discoveredCameras.length})
                </Typography>
                
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={() => setDiscoveredCameras([])}
                  disabled={scanning || discoveredCameras.length === 0}
                >
                  Clear
                </Button>
              </Box>
              
              <Divider />
              
              {discoveredCameras.length === 0 && !scanning ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    No cameras discovered yet. Start a scan to find cameras on your network.
                  </Typography>
                </Box>
              ) : (
                <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                  {discoveredCameras.map((camera) => (
                    <ListItem key={camera.id}>
                      <ListItemAvatar>
                        <VideocamIcon fontSize="large" />
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${camera.manufacturer} ${camera.model}`}
                        secondary={
                          <>
                            <Typography component="span" variant="body2">
                              {camera.address}:{camera.port}
                            </Typography>
                            <br />
                            <Typography component="span" variant="body2" color="text.secondary">
                              {existingCameras.includes(`${camera.address}:${camera.port}`) ? 
                                "Already in system" : "New camera"}
                            </Typography>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton 
                          edge="end" 
                          onClick={() => fetchCameraProfiles(camera)}
                          disabled={fetchingProfiles === camera.id}
                        >
                          {fetchingProfiles === camera.id ? 
                            <CircularProgress size={24} /> : 
                            <InfoIcon />
                          }
                        </IconButton>
                        <IconButton 
                          edge="end" 
                          onClick={() => addCamera(camera)}
                          disabled={existingCameras.includes(`${camera.address}:${camera.port}`)}
                          sx={{ ml: 1 }}
                        >
                          <AddIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
        
        {/* Credentials Dialog */}
        <Dialog open={credentialsDialogOpen} onClose={() => setCredentialsDialogOpen(false)}>
          <DialogTitle>Camera Credentials</DialogTitle>
          <DialogContent>
            <Typography variant="body2" paragraph>
              Enter credentials for {selectedCamera?.address}:{selectedCamera?.port}
            </Typography>
            
            {credentialsError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {credentialsError}
              </Alert>
            )}
            
            <TextField
              label="Username"
              fullWidth
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              margin="dense"
            />
            
            <TextField
              label="Password"
              fullWidth
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCredentialsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCredentialsSubmit} 
              variant="contained" 
              disabled={savingCredentials}
              startIcon={savingCredentials ? <CircularProgress size={24} /> : null}
            >
              {savingCredentials ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Camera Details Dialog */}
        <Dialog 
          open={detailsDialogOpen} 
          onClose={() => setDetailsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Camera Details</DialogTitle>
          <DialogContent>
            {selectedCameraDetails && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Device Information
                  </Typography>
                  
                  <Typography variant="body1">
                    <strong>Manufacturer:</strong> {selectedCameraDetails.manufacturer}
                  </Typography>
                  
                  <Typography variant="body1">
                    <strong>Model:</strong> {selectedCameraDetails.model}
                  </Typography>
                  
                  <Typography variant="body1">
                    <strong>Address:</strong> {selectedCameraDetails.address}:{selectedCameraDetails.port}
                  </Typography>
                  
                  {selectedCameraDetails.firmwareVersion && (
                    <Typography variant="body1">
                      <strong>Firmware:</strong> {selectedCameraDetails.firmwareVersion}
                    </Typography>
                  )}
                  
                  {selectedCameraDetails.serialNumber && (
                    <Typography variant="body1">
                      <strong>Serial Number:</strong> {selectedCameraDetails.serialNumber}
                    </Typography>
                  )}
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    ONVIF Profiles
                  </Typography>
                  
                  {selectedCameraDetails.profiles && selectedCameraDetails.profiles.length > 0 ? (
                    <List dense>
                      {selectedCameraDetails.profiles.map((profile) => (
                        <ListItem key={profile.token}>
                          <ListItemText
                            primary={profile.name}
                            secondary={
                              <>
                                <Typography component="span" variant="body2">
                                  {profile.resolution.width}x{profile.resolution.height}, {profile.encoding}, {profile.fps} fps
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No profiles available
                    </Typography>
                  )}
                </Grid>
                
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      addCamera(selectedCameraDetails);
                    }}
                    disabled={existingCameras.includes(`${selectedCameraDetails.address}:${selectedCameraDetails.port}`)}
                    fullWidth
                  >
                    Add Camera to System
                  </Button>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ONVIFDiscovery;