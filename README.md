# OmniSight - Microservices-Based Network Video Recorder (NVR) System

OmniSight is a modern Network Video Recorder (NVR) system built with a microservices architecture using Node.js, TypeScript, PostgreSQL with Sequelize ORM, and React.

## System Overview

OmniSight provides the following capabilities:
- Multi-protocol support for camera streams (RTSP, MJPEG, WebRTC, HLS, ONVIF)
- Hardware-accelerated video processing for NVIDIA, AMD, and Intel GPUs
- Record video streams continuously to storage with efficient segmentation
- Perform object detection and motion analysis
- PTZ camera control for supported protocols
- Advanced analytics dashboard with visualization
- Third-party extension API with webhook support
- Comprehensive event detection and notification system
- Modern React-based user interface for monitoring and playback

## Implementation Status

All planned features have been successfully implemented across the following areas:

1. **Camera Protocol Support** - Supporting multiple camera protocols including:
   - Hikvision, Dahua, and Axis proprietary protocols
   - Protocol abstraction layer with unified interface
   - WebRTC for ultra-low latency streaming
   - MJPEG with advanced buffer controls
   - ONVIF standard with PTZ and profile support
   - Enhanced HLS with adaptive bitrate

2. **Hardware Acceleration** - GPU-accelerated processing:
   - Unified acceleration framework
   - NVIDIA CUDA/NVENC/NVDEC support
   - AMD ROCm/AMF support
   - Intel oneAPI/QuickSync support

3. **Advanced Features**:
   - Comprehensive analytics dashboard
   - Third-party extension API with webhooks
   - Interactive timeline with event markers
   - Multi-camera grid view with PTZ controls

For a detailed implementation plan and status of all features, see the [Implementation Plan](implementation-plan.md).

## Architecture

OmniSight is built using a microservices architecture with the following components:

1. **Stream Ingestion Service**: Handles camera stream connections, protocol detection, and distribution
2. **Recording Service**: Manages video recording, segmentation, and storage
3. **Object Detection Service**: Processes video frames for motion/object detection using TensorFlow.js
4. **Metadata & Events Service**: Stores detection events and video metadata in PostgreSQL using Sequelize ORM
5. **Frontend Service**: React-based UI for live viewing, playback, and configuration
6. **API Gateway**: Unified entry point for frontend and external integrations

## Technology Stack

- **Backend Services**: Node.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React with TypeScript, Material-UI
- **Communication**: REST APIs, WebSockets, and RabbitMQ
- **Container Platform**: Docker and Docker Compose
- **Video Processing**: FFmpeg, TensorFlow.js, WebRTC
- **Hardware Acceleration**: NVIDIA CUDA, AMD ROCm, Intel oneAPI
- **Object Detection**: TensorFlow.js with hardware acceleration

## Project Structure

```
OmniSight/
├── docs/                       # Documentation files
│   ├── architecture/           # Architecture diagrams
│   ├── api/                    # API documentation
│   └── database/               # Database schema and models
├── services/                   # Microservices
│   ├── stream-ingestion/       # Stream Ingestion Service
│   ├── recording/              # Recording Service
│   ├── object-detection/       # Object Detection Service
│   ├── metadata-events/        # Metadata & Events Service
│   ├── frontend/               # Frontend Service (React)
│   └── api-gateway/            # API Gateway Service
├── shared/                     # Shared libraries and utilities
│   ├── models/                 # Shared data models
│   ├── camera-protocols/       # Protocol abstraction layer
│   ├── hardware-acceleration/  # Hardware acceleration framework
│   └── messaging/              # Messaging utilities
└── docker-compose.yml          # Docker Compose configuration
```

## API Endpoints

The system provides comprehensive API endpoints for all features, including:

- `/protocols/*` - Camera protocol management and discovery
- `/streams/*` - Stream management for different protocols (WebRTC, MJPEG, HLS)
- `/analytics/*` - Analytics data and visualization
- `/extensions/*` - Third-party extension management

For complete API documentation, visit the Swagger docs at `http://localhost:8000/api-docs`.

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Docker and Docker Compose
- PostgreSQL
- Git
- (Optional) NVIDIA, AMD, or Intel GPU for hardware acceleration

### Development Setup

1. Clone the repository:
   ```
   git clone https://github.com/piwi3910/OmniSight.git
   cd OmniSight
   ```

2. Install dependencies for all services:
   ```
   # Script to install dependencies for all services
   ./scripts/install-all.sh
   ```

3. Start the development environment:
   ```
   docker-compose up -d
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:8000
   - Swagger Documentation: http://localhost:8000/api-docs

## Deployment

Detailed deployment instructions can be found in the [Deployment Guide](docs/deployment.md).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Contact

For questions or support, please contact:
- Pascal Watteel
- Email: Pascal@watteel.com
- GitHub: [https://github.com/piwi3910](https://github.com/piwi3910)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.