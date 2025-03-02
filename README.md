# OmniSight - Microservices-Based Network Video Recorder (NVR) System

OmniSight is a modern Network Video Recorder (NVR) system built with a microservices architecture using Node.js, TypeScript, PostgreSQL with Sequelize ORM, and React.

## System Overview

OmniSight provides the following capabilities:
- Accept and process RTSP streams from security cameras
- Record video streams continuously to storage with efficient segmentation
- Perform object detection and motion analysis
- Store and manage metadata and events
- Provide a modern React-based user interface for monitoring and playback

## Architecture

OmniSight is built using a microservices architecture with the following components:

1. **Stream Ingestion Service**: Handles RTSP stream connections, authentication, and distribution
2. **Recording Service**: Manages video recording, segmentation, and storage
3. **Object Detection Service**: Processes video frames for motion/object detection using TensorFlow.js
4. **Metadata & Events Service**: Stores detection events and video metadata in PostgreSQL using Sequelize ORM
5. **Frontend Service**: React-based UI for live viewing, playback, and configuration
6. **API Gateway**: Unified entry point for frontend and external integrations

## Technology Stack

- **Backend Services**: Node.js with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Frontend**: React with TypeScript
- **Communication**: REST APIs and WebSockets
- **Container Platform**: Docker and Docker Compose
- **Message Queue**: RabbitMQ or Redis for video frame distribution
- **Object Detection**: TensorFlow.js for Node.js

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
│   ├── utils/                  # Utility functions
│   └── config/                 # Configuration utilities
└── docker-compose.yml          # Docker Compose configuration
```

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Docker and Docker Compose
- PostgreSQL
- Git

### Development Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/OmniSight.git
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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.