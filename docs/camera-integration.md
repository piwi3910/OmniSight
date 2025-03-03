# Camera Integration Guide

## Real Camera Configuration

OmniSight has been configured to use real IP cameras on the network. The system is set up to connect to cameras with the following parameters:

| Location | IP Address | Username | Password | RTSP URL |
|----------|------------|----------|----------|----------|
| Front Door | 192.168.10.21 | frigate | Jbz49teq01! | rtsp://frigate:Jbz49teq01!@192.168.10.21/Preview_01_main |
| Backyard | 192.168.10.22 | frigate | Jbz49teq01! | rtsp://frigate:Jbz49teq01!@192.168.10.22/Preview_01_main |
| Garage | 192.168.10.23 | frigate | Jbz49teq01! | rtsp://frigate:Jbz49teq01!@192.168.10.23/Preview_01_main |
| Driveway | 192.168.10.24 | frigate | Jbz49teq01! | rtsp://frigate:Jbz49teq01!@192.168.10.24/Preview_01_main |
| Side Entrance | 192.168.10.25 | frigate | Jbz49teq01! | rtsp://frigate:Jbz49teq01!@192.168.10.25/Preview_01_main |

## Testing Camera Connections

The system includes a testing script to verify connectivity with the cameras:

```bash
# From the stream-ingestion service directory
npm run test-cameras
```

This script attempts to connect to each camera, start a stream, capture frames, and report the results. It's a useful tool for troubleshooting camera connectivity issues.

## Stream Integration Architecture

The OmniSight system connects to IP cameras using the following flow:

1. The Stream Ingestion Service connects to the camera's RTSP stream
2. Video frames are captured and processed using FFmpeg
3. Frames are published to RabbitMQ for distribution to other services
4. The Recording Service subscribes to frames and stores them as video segments
5. The Object Detection Service analyzes frames for objects of interest
6. The Metadata & Events Service stores detection events and manages notifications

## Configuration Options

Camera streams can be configured with the following parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| frameRate | Frames per second to capture | 10 |
| width | Frame width in pixels | 640 |
| height | Frame height in pixels | 480 |
| reconnectInterval | Milliseconds to wait before reconnecting a failed stream | 5000 |

These parameters can be adjusted in the environment variables or directly in the config file.

## RTSP URL Format

The RTSP URL format used in this system embeds authentication credentials directly in the URL:

```
rtsp://[username]:[password]@[ip-address]/[stream-path]
```

For example:
```
rtsp://frigate:Jbz49teq01!@192.168.10.21/Preview_01_main
```

This format is required for proper authentication with the specific IP cameras used in this system.

## Adding New Cameras

To add a new camera to the system:

1. Determine the camera's IP address, RTSP URL pattern, and login credentials
2. Add the camera to the database:
   ```
   POST /api/v1/cameras
   {
     "name": "New Camera",
     "rtspUrl": "rtsp://username:password@192.168.10.X/Preview_01_main",
     "username": "username",
     "password": "password",
     "location": "Location Description"
   }
   ```
3. The system will automatically attempt to connect to the camera

## Handling Camera Authentication

The system supports several authentication methods for cameras:

1. **URL Authentication**: Credentials embedded in the RTSP URL (primary method)
2. **Digest Authentication**: Used by many IP cameras
3. **Basic Authentication**: Simple username/password authentication

The Stream Ingestion Service will automatically handle the appropriate authentication method based on the camera's response.

## Troubleshooting

Common camera connection issues:

1. **Connection Timeout**: Verify the camera's IP address and network connectivity
2. **Authentication Failure**: Check username and password
3. **Stream Format Issues**: Verify the correct RTSP path (/Preview_01_main)
4. **Firewall Blocking**: Ensure ports 554 (RTSP) and 8554 (RTSP over HTTP) are open

## Next Steps in Implementation

For complete camera integration, the following components still need to be implemented:

1. **ONVIF Protocol Support**: For camera discovery and PTZ control
2. **Camera Health Monitoring**: Regular connectivity checks and alerts
3. **Image Quality Settings**: Adjustable bitrate and compression settings
4. **Motion Detection Zones**: Define regions of interest for detection
5. **Camera Grouping**: Logical organization of cameras by location or purpose