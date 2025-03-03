import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Typography,
  Box,
  Slider,
  CircularProgress,
  Alert,
  Grid,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormLabel,
  Divider,
  IconButton
} from '@mui/material';
import {
  Download as DownloadIcon,
  Backup as BackupIcon,
  Movie as MovieIcon,
  ContentCut as TrimIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';

interface ExportVideoDialogProps {
  open: boolean;
  onClose: () => void;
  recordingId: string;
  recordingName: string;
  cameraName: string;
  segments: any[];
  token: string;
  selectedSegmentId?: string;
  currentTime?: number;
  API_URL: string;
}

interface ExportParams {
  recordingId: string;
  filename: string;
  format: 'mp4' | 'avi' | 'mov';
  quality: 'high' | 'medium' | 'low';
  watermark: {
    text: string;
    opacity: number;
    position: string;
    includeTimestamp: boolean;
    includeCameraName: boolean;
  } | null;
  metadata: {
    include: boolean;
    includeEvents: boolean;
  };
  segmentId?: string;
  timeRange?: {
    start: number;
    end: number;
  };
}

const ExportVideoDialog: React.FC<ExportVideoDialogProps> = ({
  open,
  onClose,
  recordingId,
  recordingName,
  cameraName,
  segments,
  token,
  selectedSegmentId,
  currentTime,
  API_URL
}) => {
  // Export settings
  const [exportType, setExportType] = useState<'segment' | 'range'>('segment');
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 0]);
  const [filename, setFilename] = useState<string>('');
  const [fileFormat, setFileFormat] = useState<'mp4' | 'avi' | 'mov'>('mp4');
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');
  
  // Watermark settings
  const [enableWatermark, setEnableWatermark] = useState<boolean>(false);
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(30);
  const [watermarkPosition, setWatermarkPosition] = useState<string>('bottomRight');
  const [includeTimestamp, setIncludeTimestamp] = useState<boolean>(true);
  const [includeCameraName, setIncludeCameraName] = useState<boolean>(true);
  
  // Metadata settings
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true);
  const [includeEvents, setIncludeEvents] = useState<boolean>(true);
  
  // Export progress
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportURL, setExportURL] = useState<string | null>(null);
  
  // Initialize filename and selected segment when dialog opens
  useEffect(() => {
    if (open) {
      // Generate default filename: CameraName_RecordingName_Date
      const defaultFilename = `${cameraName.replace(/\s+/g, '_')}_${
        recordingName ? recordingName.replace(/\s+/g, '_') : 'Recording'
      }_${format(new Date(), 'yyyyMMdd_HHmmss')}`;
      setFilename(defaultFilename);
      
      // Set default watermark text
      setWatermarkText(`${cameraName} - ${format(new Date(), 'yyyy-MM-dd')}`);
      
      // Initialize selected segment
      if (selectedSegmentId && segments.some(s => s.id === selectedSegmentId)) {
        setSelectedSegment(selectedSegmentId);
      } else if (segments.length > 0) {
        setSelectedSegment(segments[0].id);
      }
      
      // Reset export state
      setExporting(false);
      setExportProgress(0);
      setExportError(null);
      setExportURL(null);
    }
  }, [open, cameraName, recordingName, segments, selectedSegmentId]);
  
  // Format time for display
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  // Handle export action
  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    setExportError(null);
    setExportURL(null);
    
    try {
      const exportParams: ExportParams = {
        recordingId,
        filename: filename || `Export_${new Date().getTime()}`,
        format: fileFormat,
        quality,
        watermark: enableWatermark ? {
          text: watermarkText,
          opacity: watermarkOpacity / 100,
          position: watermarkPosition,
          includeTimestamp,
          includeCameraName
        } : null,
        metadata: {
          include: includeMetadata,
          includeEvents
        }
      };
      
      // Add export type specific parameters
      if (exportType === 'segment') {
        exportParams.segmentId = selectedSegment;
      } else {
        exportParams.timeRange = {
          start: timeRange[0],
          end: timeRange[1]
        };
      }
      
      // Start export process
      const response = await axios.post(
        `${API_URL}/recordings/${recordingId}/export`,
        exportParams,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const exportId = response.data.exportId;
      
      // Poll for export progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(
            `${API_URL}/recordings/export/${exportId}/status`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          
          const { status, progress, url, error } = statusResponse.data;
          
          setExportProgress(progress);
          
          if (status === 'completed') {
            setExporting(false);
            setExportURL(url);
            clearInterval(pollInterval);
          } else if (status === 'failed') {
            setExporting(false);
            setExportError(error || 'Export failed');
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Error polling export status:', error);
          setExporting(false);
          setExportError('Failed to check export status');
          clearInterval(pollInterval);
        }
      }, 2000);
    } catch (error) {
      console.error('Error starting export:', error);
      setExporting(false);
      setExportError('Failed to start export process');
    }
  };
  
  // Handle download of exported file
  const handleDownload = () => {
    if (exportURL) {
      const link = document.createElement('a');
      link.href = exportURL;
      link.download = `${filename}.${fileFormat}`;
      link.click();
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={exporting ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Export Recording
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          disabled={exporting}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {exportError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {exportError}
          </Alert>
        )}
        
        {exportURL && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Export completed successfully!
            <Button 
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ ml: 2 }}
            >
              Download
            </Button>
          </Alert>
        )}
        
        {exporting ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress variant="determinate" value={exportProgress} size={60} thickness={4} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Exporting Video ({exportProgress}%)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Please wait while your video is being processed...
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Export Type */}
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <FormLabel component="legend">Export Type</FormLabel>
                <RadioGroup
                  row
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as 'segment' | 'range')}
                >
                  <FormControlLabel 
                    value="segment" 
                    control={<Radio />} 
                    label="Export Segment" 
                  />
                  <FormControlLabel 
                    value="range" 
                    control={<Radio />} 
                    label="Export Custom Range" 
                  />
                </RadioGroup>
              </FormControl>
            </Grid>
            
            {/* Segment Selection */}
            {exportType === 'segment' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Segment</InputLabel>
                  <Select
                    value={selectedSegment}
                    onChange={(e) => setSelectedSegment(e.target.value)}
                    label="Select Segment"
                    disabled={segments.length === 0}
                  >
                    {segments.map((segment, index) => (
                      <MenuItem key={segment.id} value={segment.id}>
                        Segment {index + 1} ({format(new Date(segment.startTime), 'HH:mm:ss')} - {format(new Date(segment.endTime), 'HH:mm:ss')})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            {/* Time Range Selection */}
            {exportType === 'range' && (
              <Grid item xs={12}>
                <Box sx={{ px: 2 }}>
                  <Typography gutterBottom>
                    Time Range: {formatTime(timeRange[0])} - {formatTime(timeRange[1])}
                  </Typography>
                  <Slider
                    value={timeRange}
                    onChange={(_, newValue) => setTimeRange(newValue as [number, number])}
                    valueLabelDisplay="auto"
                    valueLabelFormat={formatTime}
                    min={0}
                    max={segments.reduce((total, segment) => total + (segment.duration || 0), 0)}
                  />
                </Box>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Divider />
            </Grid>
            
            {/* File Options */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                File Options
              </Typography>
              
              <TextField
                fullWidth
                label="Filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                margin="normal"
                variant="outlined"
              />
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Format</InputLabel>
                <Select
                  value={fileFormat}
                  onChange={(e) => setFileFormat(e.target.value as 'mp4' | 'avi' | 'mov')}
                  label="Format"
                >
                  <MenuItem value="mp4">MP4 (H.264)</MenuItem>
                  <MenuItem value="avi">AVI</MenuItem>
                  <MenuItem value="mov">MOV (QuickTime)</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Quality</InputLabel>
                <Select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as 'high' | 'medium' | 'low')}
                  label="Quality"
                >
                  <MenuItem value="high">High (Original Resolution)</MenuItem>
                  <MenuItem value="medium">Medium (720p)</MenuItem>
                  <MenuItem value="low">Low (480p)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Watermark Options */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">
                  Watermark Options
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={enableWatermark}
                      onChange={(e) => setEnableWatermark(e.target.checked)}
                    />
                  }
                  label="Enable Watermark"
                />
              </Box>
              
              <TextField
                fullWidth
                label="Watermark Text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                margin="normal"
                variant="outlined"
                disabled={!enableWatermark}
              />
              
              <FormControl fullWidth margin="normal" disabled={!enableWatermark}>
                <InputLabel>Position</InputLabel>
                <Select
                  value={watermarkPosition}
                  onChange={(e) => setWatermarkPosition(e.target.value)}
                  label="Position"
                >
                  <MenuItem value="topLeft">Top Left</MenuItem>
                  <MenuItem value="topRight">Top Right</MenuItem>
                  <MenuItem value="bottomLeft">Bottom Left</MenuItem>
                  <MenuItem value="bottomRight">Bottom Right</MenuItem>
                  <MenuItem value="center">Center</MenuItem>
                </Select>
              </FormControl>
              
              <Box sx={{ mt: 2, px: 1, opacity: enableWatermark ? 1 : 0.5, pointerEvents: enableWatermark ? 'auto' : 'none' }}>
                <Typography gutterBottom>
                  Opacity: {watermarkOpacity}%
                </Typography>
                <Slider
                  value={watermarkOpacity}
                  onChange={(_, newValue) => setWatermarkOpacity(newValue as number)}
                  disabled={!enableWatermark}
                />
              </Box>
              
              <FormGroup row sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeTimestamp}
                      onChange={(e) => setIncludeTimestamp(e.target.checked)}
                      disabled={!enableWatermark}
                    />
                  }
                  label="Include Timestamp"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeCameraName}
                      onChange={(e) => setIncludeCameraName(e.target.checked)}
                      disabled={!enableWatermark}
                    />
                  }
                  label="Include Camera Name"
                />
              </FormGroup>
            </Grid>
            
            <Grid item xs={12}>
              <Divider />
            </Grid>
            
            {/* Metadata Options */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Metadata Options
              </Typography>
              
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeMetadata}
                      onChange={(e) => setIncludeMetadata(e.target.checked)}
                    />
                  }
                  label="Include Metadata File"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeEvents}
                      onChange={(e) => setIncludeEvents(e.target.checked)}
                    />
                  }
                  label="Include Event Information"
                />
              </FormGroup>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={exporting}
        >
          Cancel
        </Button>
        {exportURL ? (
          <Button 
            variant="contained" 
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
          >
            Download
          </Button>
        ) : (
          <Button 
            variant="contained" 
            startIcon={<MovieIcon />}
            onClick={handleExport}
            disabled={exporting || (exportType === 'segment' && !selectedSegment)}
          >
            {exporting ? 'Exporting...' : 'Export Video'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ExportVideoDialog;