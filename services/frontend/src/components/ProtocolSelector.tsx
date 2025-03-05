import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import InfoIcon from '@mui/icons-material/Info';
import axios from 'axios';
import { API_BASE_URL, CAMERA_PROTOCOLS } from '../config';

interface ProtocolSelectorProps {
  cameraId: string;
  onChange?: (protocol: string) => void;
  disabled?: boolean;
}

interface DetectionResult {
  protocol: string;
  name: string;
  model?: string;
  manufacturer?: string;
}

const ProtocolSelector: React.FC<ProtocolSelectorProps> = ({
  cameraId,
  onChange,
  disabled = false
}) => {
  const [protocol, setProtocol] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load current protocol from camera
  useEffect(() => {
    const fetchCamera = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/cameras/${cameraId}`);
        if (response.data.protocolType) {
          setProtocol(response.data.protocolType);
          if (onChange) {
            onChange(response.data.protocolType);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching camera details:', err);
        setError('Failed to load camera protocol information');
        setLoading(false);
      }
    };

    if (cameraId) {
      fetchCamera();
    }
  }, [cameraId, onChange]);

  // Handle protocol change
  const handleProtocolChange = (event: SelectChangeEvent<string>) => {
    const newProtocol = event.target.value;
    setProtocol(newProtocol);
    if (onChange) {
      onChange(newProtocol);
    }
  };

  // Auto-detect camera protocol
  const handleDetectProtocol = async () => {
    setDetecting(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/protocols/${cameraId}/detect`);
      setDetectionResult(response.data);
      setProtocol(response.data.protocol);
      if (onChange) {
        onChange(response.data.protocol);
      }
    } catch (err) {
      console.error('Error detecting protocol:', err);
      setError('Failed to detect camera protocol');
      setDetectionResult(null);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Camera Protocol
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth disabled={loading || disabled}>
              <InputLabel id="protocol-select-label">Protocol</InputLabel>
              <Select
                labelId="protocol-select-label"
                id="protocol-select"
                value={protocol}
                label="Protocol"
                onChange={handleProtocolChange}
              >
                <MenuItem value="">
                  <em>Auto-detect</em>
                </MenuItem>
                {CAMERA_PROTOCOLS.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Select the protocol to use for communication with this camera
              </FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="outlined"
              startIcon={detecting ? <CircularProgress size={24} /> : <AutorenewIcon />}
              onClick={handleDetectProtocol}
              disabled={detecting || disabled}
              fullWidth
            >
              {detecting ? 'Detecting Protocol...' : 'Auto-detect Protocol'}
            </Button>
          </Grid>

          {error && (
            <Grid item xs={12}>
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            </Grid>
          )}

          {detectionResult && (
            <Grid item xs={12}>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Detection Result
                </Typography>
                <Typography variant="body2">
                  Protocol: <strong>{detectionResult.name}</strong>
                </Typography>
                {detectionResult.model && (
                  <Typography variant="body2">
                    Model: <strong>{detectionResult.model}</strong>
                  </Typography>
                )}
                {detectionResult.manufacturer && (
                  <Typography variant="body2">
                    Manufacturer: <strong>{detectionResult.manufacturer}</strong>
                  </Typography>
                )}
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default ProtocolSelector;