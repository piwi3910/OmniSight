import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Chip, 
  LinearProgress, 
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import { styled, Theme } from '@mui/material/styles';
import { 
  CheckCircle as CheckCircleIcon, 
  Warning as WarningIcon, 
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkCheckIcon
} from '@mui/icons-material';
import axios from 'axios';

// Define styled components
const StatusChip = styled(Chip)<{ status: string }>(({ theme, status }) => ({
  backgroundColor: 
    status === 'ok' ? theme.palette.success.main : 
    status === 'degraded' ? theme.palette.warning.main : 
    theme.palette.error.main,
  color: '#fff',
  fontWeight: 'bold'
}));

const ServiceCard = styled(Card)<{ status: string }>(({ theme, status }) => ({
  border: `1px solid ${
    status === 'ok' ? theme.palette.success.main : 
    status === 'degraded' ? theme.palette.warning.main : 
    theme.palette.error.main
  }`,
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[5],
    transform: 'translateY(-5px)'
  }
}));

interface HealthData {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    free: number;
    usagePercent: number;
  };
  cpu: {
    cores: number;
    loadAvg: number[];
  };
  dependencies: Record<string, {
    status: 'ok' | 'degraded' | 'error';
    type: string;
    responseTime?: number;
    details?: any;
  }>;
}

const SystemMonitoring: React.FC = () => {
  const [healthData, setHealthData] = useState<Record<string, HealthData | null>>({
    'api-gateway': null,
    'metadata-events': null,
    'stream-ingestion': null,
    'recording': null,
    'object-detection': null
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<number>(0);
  const [refreshInterval, setRefreshInterval] = useState<number>(10000); // 10 seconds
  const [selectedService, setSelectedService] = useState<string>('api-gateway');

  // Function to get health data from all services
  const fetchHealthData = async () => {
    setLoading(true);
    setError(null);
    
    const services = {
      'api-gateway': process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3000',
      'metadata-events': process.env.REACT_APP_METADATA_EVENTS_URL || 'http://localhost:3001',
      'stream-ingestion': process.env.REACT_APP_STREAM_INGESTION_URL || 'http://localhost:3002',
      'recording': process.env.REACT_APP_RECORDING_URL || 'http://localhost:3003',
      'object-detection': process.env.REACT_APP_OBJECT_DETECTION_URL || 'http://localhost:3004'
    };
    
    const newHealthData: Record<string, HealthData | null> = { ...healthData };
    
    try {
      await Promise.all(
        Object.entries(services).map(async ([serviceName, url]) => {
          try {
            const response = await axios.get(`${url}/health`, {
              timeout: 5000,
              headers: {
                'Cache-Control': 'no-cache'
              }
            });
            
            newHealthData[serviceName] = response.data;
          } catch (err) {
            console.error(`Error fetching health data for ${serviceName}:`, err);
            // Keep previous data if available
            if (!newHealthData[serviceName]) {
              newHealthData[serviceName] = {
                status: 'error',
                service: serviceName,
                version: 'unknown',
                timestamp: new Date().toISOString(),
                uptime: 0,
                memory: { used: 0, total: 0, free: 0, usagePercent: 0 },
                cpu: { cores: 0, loadAvg: [0, 0, 0] },
                dependencies: {}
              };
            }
          }
        })
      );
      
      setHealthData(newHealthData);
    } catch (err) {
      setError('Failed to fetch health data');
      console.error('Error fetching health data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch health data on component mount and at regular intervals
  useEffect(() => {
    fetchHealthData();
    
    const interval = setInterval(() => {
      fetchHealthData();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Format uptime
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircleIcon color="success" />;
      case 'degraded':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <CircularProgress size={20} />;
    }
  };

  // Render system overview cards
  const renderSystemOverview = () => {
    return (
      <Grid container spacing={3}>
        {Object.entries(healthData).map(([serviceName, data]) => (
          <Grid item xs={12} sm={6} md={4} key={serviceName}>
            <ServiceCard 
              status={data?.status || 'error'}
              onClick={() => setSelectedService(serviceName)}
              sx={{ cursor: 'pointer' }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">{serviceName}</Typography>
                  {data ? (
                    <StatusChip
                      status={data.status}
                      label={data.status.toUpperCase()}
                      icon={getStatusIcon(data.status)}
                    />
                  ) : (
                    <CircularProgress size={20} />
                  )}
                </Box>
                
                {data ? (
                  <>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Version: {data.version}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Uptime: {formatUptime(data.uptime)}
                    </Typography>
                    
                    <Box mt={2}>
                      <Typography variant="body2" gutterBottom>
                        Memory Usage: {data.memory.usagePercent.toFixed(1)}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={data.memory.usagePercent} 
                        color={
                          data.memory.usagePercent > 90 ? 'error' : 
                          data.memory.usagePercent > 70 ? 'warning' : 
                          'success'
                        }
                      />
                    </Box>
                    
                    <Box mt={2}>
                      <Typography variant="body2" gutterBottom>
                        CPU Load (1m): {data.cpu.loadAvg[0].toFixed(2)}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(data.cpu.loadAvg[0] / data.cpu.cores * 100, 100)} 
                        color={
                          data.cpu.loadAvg[0] / data.cpu.cores > 0.9 ? 'error' : 
                          data.cpu.loadAvg[0] / data.cpu.cores > 0.7 ? 'warning' : 
                          'success'
                        }
                      />
                    </Box>
                    
                    <Box mt={2}>
                      <Typography variant="body2" gutterBottom>
                        Dependencies: {
                          Object.values(data.dependencies).filter(d => d.status === 'error').length > 0 ? 
                          'Issues Detected' : 'All Healthy'
                        }
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Box display="flex" justifyContent="center" my={2}>
                    <CircularProgress />
                  </Box>
                )}
              </CardContent>
            </ServiceCard>
          </Grid>
        ))}
      </Grid>
    );
  };

  // Render service details
  const renderServiceDetails = () => {
    const data = healthData[selectedService];
    
    if (!data) {
      return (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      );
    }
    
    return (
      <Box mt={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">{selectedService} Details</Typography>
          <Button 
            startIcon={<RefreshIcon />}
            variant="outlined"
            onClick={() => fetchHealthData()}
          >
            Refresh
          </Button>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Information
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getStatusIcon(data.status)}
                            {data.status.toUpperCase()}
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Version</strong></TableCell>
                        <TableCell>{data.version}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Uptime</strong></TableCell>
                        <TableCell>{formatUptime(data.uptime)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Last Updated</strong></TableCell>
                        <TableCell>{new Date(data.timestamp).toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Resource Usage
                </Typography>
                
                <Box mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <MemoryIcon />
                    <Typography variant="body1">Memory</Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {Math.round(data.memory.used)} MB / {Math.round(data.memory.total)} MB ({data.memory.usagePercent.toFixed(1)}%)
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={data.memory.usagePercent} 
                    color={
                      data.memory.usagePercent > 90 ? 'error' : 
                      data.memory.usagePercent > 70 ? 'warning' : 
                      'success'
                    }
                  />
                </Box>
                
                <Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TimelineIcon />
                    <Typography variant="body1">CPU Load</Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {data.cpu.cores} cores, Load: {data.cpu.loadAvg.map(l => l.toFixed(2)).join(', ')}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(data.cpu.loadAvg[0] / data.cpu.cores * 100, 100)} 
                    color={
                      data.cpu.loadAvg[0] / data.cpu.cores > 0.9 ? 'error' : 
                      data.cpu.loadAvg[0] / data.cpu.cores > 0.7 ? 'warning' : 
                      'success'
                    }
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Dependencies
                </Typography>
                
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Response Time</TableCell>
                        <TableCell>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(data.dependencies).map(([name, dependency]) => (
                        <TableRow key={name}>
                          <TableCell>{name}</TableCell>
                          <TableCell>{dependency.type}</TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              {getStatusIcon(dependency.status)}
                              {dependency.status.toUpperCase()}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {dependency.responseTime ? `${dependency.responseTime.toFixed(2)} ms` : '-'}
                          </TableCell>
                          <TableCell>
                            {dependency.details ? 
                              JSON.stringify(dependency.details).slice(0, 50) + (JSON.stringify(dependency.details).length > 50 ? '...' : '')
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
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

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">System Monitoring</Typography>
        <Box>
          <Button 
            startIcon={<RefreshIcon />}
            variant="contained"
            onClick={() => fetchHealthData()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Box mb={3}>
          <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        </Box>
      )}
      
      <Tabs 
        value={currentTab} 
        onChange={handleTabChange}
        sx={{ mb: 3 }}
      >
        <Tab label="System Overview" />
        <Tab label="Service Details" />
      </Tabs>
      
      {currentTab === 0 && renderSystemOverview()}
      {currentTab === 1 && renderServiceDetails()}
    </Box>
  );
};

export default SystemMonitoring;