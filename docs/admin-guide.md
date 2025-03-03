# OmniSight Administrator Guide

## Introduction

This guide is intended for system administrators responsible for deploying, configuring, and maintaining the OmniSight video surveillance system. It covers advanced configuration, performance tuning, troubleshooting, and best practices for ensuring a reliable and secure surveillance environment.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Installation](#installation)
3. [Microservice Configuration](#microservice-configuration)
4. [Database Management](#database-management)
5. [Storage Management](#storage-management)
6. [User & Role Management](#user--role-management)
7. [Security Configuration](#security-configuration)
8. [Performance Tuning](#performance-tuning)
9. [Backup & Recovery](#backup--recovery)
10. [Scaling Strategies](#scaling-strategies)
11. [Monitoring & Alerting](#monitoring--alerting)
12. [Troubleshooting](#troubleshooting)
13. [Maintenance Tasks](#maintenance-tasks)
14. [API Integration](#api-integration)

## System Architecture

OmniSight is built on a modern microservices architecture designed for scalability and resilience.

### Core Services

1. **API Gateway**: Front-facing service that handles authentication, routing, and API requests
   - Port: 3000
   - Key files: `/services/api-gateway/`

2. **Stream Ingestion**: Manages camera connections and real-time video streams
   - Port: 3001
   - Key files: `/services/stream-ingestion/`

3. **Recording**: Handles video recording, segmentation, and storage
   - Port: 3002
   - Key files: `/services/recording/`

4. **Object Detection**: Processes video frames for object detection
   - Port: 3003
   - Key files: `/services/object-detection/`

5. **Metadata & Events**: Manages event storage, searching, and notifications
   - Port: 3004
   - Key files: `/services/metadata-events/`

6. **Frontend**: Web interface for user interaction
   - Port: 80/443
   - Key files: `/services/frontend/`

### Infrastructure Components

- **PostgreSQL Database**: Stores metadata, events, and system configuration
- **RabbitMQ**: Message broker for inter-service communication
- **Redis**: Caching layer for performance optimization
- **Nginx**: Reverse proxy and static file server
- **Docker & Docker Compose**: Container management

### Data Flow

![Architecture Diagram](../assets/diagrams/architecture.png)

1. **Video Ingestion**: Camera streams → Stream Ingestion → RabbitMQ
2. **Recording Pipeline**: Stream Ingestion → Recording → Storage
3. **Detection Pipeline**: Stream Ingestion → Object Detection → Metadata & Events
4. **API Flow**: Client → API Gateway → Microservices

## Installation

### Prerequisites

- Docker and Docker Compose
- 16GB RAM minimum (32GB recommended for >20 cameras)
- 4 CPU cores minimum (8+ recommended)
- 100GB disk space minimum for system (additional space for recordings)
- Ubuntu 20.04 LTS or higher (recommended OS)

### Installation Steps

1. **Clone the Repository**

```bash
git clone https://github.com/your-organization/omnisight.git
cd omnisight
```

2. **Configure Environment Variables**

Copy the example environment file and modify it:

```bash
cp .env.example .env
```

Edit the `.env` file to set:
- Database credentials
- Storage paths
- Security keys
- Hardware acceleration settings

3. **Build and Start Services**

```bash
./scripts/install-all.sh
docker-compose up -d
```

4. **Initialize the Database**

```bash
docker-compose exec metadata-events npm run db:migrate
docker-compose exec metadata-events npm run db:seed
```

5. **Verify Installation**

Navigate to `http://your-server-ip` in a web browser.
Default login: `admin` / `OmniSight@123`

### Upgrading

To upgrade OmniSight:

1. Stop the current installation:
```bash
docker-compose down
```

2. Pull the latest changes:
```bash
git pull origin master
```

3. Rebuild the services:
```bash
docker-compose build
```

4. Migrate the database if necessary:
```bash
docker-compose run --rm metadata-events npm run db:migrate
```

5. Start the services:
```bash
docker-compose up -d
```

## Microservice Configuration

Each microservice has its own configuration options that can be customized.

### API Gateway

Configuration file: `/services/api-gateway/src/config/config.ts`

Key settings:
- `port`: HTTP port (default: 3000)
- `jwtSecret`: Secret key for JWT authentication
- `jwtExpiresIn`: Token expiration time
- `corsOrigin`: CORS settings for cross-domain requests
- `rateLimiting`: Rate limiting settings for API endpoints

### Stream Ingestion

Configuration file: `/services/stream-ingestion/src/config/config.ts`

Key settings:
- `port`: HTTP port (default: 3001)
- `rtspTimeout`: Timeout for RTSP connections
- `reconnectInterval`: Time between reconnection attempts
- `frameBufferSize`: Size of the frame buffer
- `threadPoolSize`: Number of worker threads

### Recording

Configuration file: `/services/recording/src/config/config.ts`

Key settings:
- `port`: HTTP port (default: 3002)
- `storagePath`: Path to recording storage
- `segmentDuration`: Duration of each recording segment
- `fileFormat`: Format of recording files
- `retentionPolicy`: Settings for recording retention

### Object Detection

Configuration file: `/services/object-detection/src/config/config.ts`

Key settings:
- `port`: HTTP port (default: 3003)
- `modelPath`: Path to detection models
- `workerCount`: Number of detection workers
- `confidenceThreshold`: Default confidence threshold
- `detectionClasses`: Object classes to detect
- `gpuEnabled`: Enable GPU acceleration

### Metadata & Events

Configuration file: `/services/metadata-events/src/config/config.ts`

Key settings:
- `port`: HTTP port (default: 3004)
- `websocketPort`: WebSocket port for real-time events
- `databaseUrl`: Database connection string
- `thumbnailsPath`: Path for event thumbnails
- `retentionDays`: Event retention period

## Database Management

OmniSight uses PostgreSQL for storing metadata, events, and system configuration.

### Database Structure

The main database tables are:
- `users`: User accounts and authentication
- `cameras`: Camera configuration and status
- `recordings`: Recording metadata
- `segments`: Video segment information
- `events`: Detected events and metadata
- `detected_objects`: Objects detected in events
- `ptz_presets`: PTZ camera presets

### Maintenance Tasks

#### Backup Database

```bash
docker-compose exec postgres pg_dump -U postgres omnisight > backup.sql
```

#### Restore Database

```bash
cat backup.sql | docker-compose exec -T postgres psql -U postgres omnisight
```

#### Performance Optimization

1. Add the following to `/etc/postgresql/12/main/postgresql.conf` (or appropriate version):

```
# Memory Settings
shared_buffers = 2GB               # 25% of available RAM
work_mem = 64MB                    # For complex queries
maintenance_work_mem = 256MB       # For maintenance operations
effective_cache_size = 6GB         # 75% of available RAM

# Query Optimization
random_page_cost = 1.1             # For SSD storage
effective_io_concurrency = 200     # For SSD storage

# Write Ahead Log
wal_buffers = 16MB                 # 1/32 of shared_buffers
synchronous_commit = off           # For better performance (with some risk)

# Background Writer
bgwriter_delay = 200ms
bgwriter_lru_maxpages = 100
```

2. Apply the database optimizations:

```bash
sudo systemctl restart postgresql
```

## Storage Management

### Storage Layout

OmniSight organizes recordings in the following structure:

```
/storage
  /recordings
    /[camera-id]
      /[recording-id]
        /segments
          segment_0.mp4
          segment_1.mp4
          ...
        metadata.json
        thumbnail.jpg
  /thumbnails
    /events
      [event-id].jpg
    /recordings
      [recording-id].jpg
  /exports
    /[export-id]
      export.mp4
      metadata.json
```

### Storage Retention Policies

Configure retention policies in `/services/recording/src/config/config.ts`:

```javascript
retention: {
  // Keep recordings for 30 days by default
  defaultDays: 30,
  
  // Camera-specific retention
  cameraOverrides: {
    'camera-id-1': 60, // 60 days
    'camera-id-2': 15  // 15 days
  },
  
  // Minimum free space before deleting old recordings (in GB)
  minFreeSpace: 50,
  
  // Check interval for retention policy (in milliseconds)
  checkInterval: 3600000 // 1 hour
}
```

### Storage Monitoring

Monitor storage usage through the admin dashboard or API:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/system/storage
```

### Storage Expansion

To add more storage:

1. Mount a new disk to the system
2. Add the disk to `/etc/fstab`
3. Update the storage paths in `.env`
4. Restart the recording service:

```bash
docker-compose restart recording
```

## User & Role Management

### User Types

OmniSight supports multiple user roles:

1. **Administrator**: Full system access
2. **Manager**: Can manage cameras and view all content
3. **Operator**: Can view live and recorded video, manage events
4. **Viewer**: Can only view live video and events

### Creating Users

Create users through the admin interface or API:

```bash
curl -X POST \
  http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "SecurePassword123",
    "email": "user@example.com",
    "role": "operator",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Role Permissions

Role permissions are defined in `/services/api-gateway/src/middleware/auth.ts`:

| Permission | Admin | Manager | Operator | Viewer |
|------------|-------|---------|----------|--------|
| View Live Video | ✓ | ✓ | ✓ | ✓ |
| View Recordings | ✓ | ✓ | ✓ | ✗ |
| View Events | ✓ | ✓ | ✓ | ✓ |
| Export Video | ✓ | ✓ | ✓ | ✗ |
| Manage Cameras | ✓ | ✓ | ✗ | ✗ |
| Manage Users | ✓ | ✗ | ✗ | ✗ |
| System Settings | ✓ | ✗ | ✗ | ✗ |

### Password Policies

Configure password policies in `/services/api-gateway/src/config/config.ts`:

```javascript
passwords: {
  // Minimum password length
  minLength: 10,
  
  // Password complexity requirements
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
  
  // Password expiration (in days, 0 = never)
  expiresAfterDays: 90,
  
  // Remember last N passwords
  historyCount: 5
}
```

## Security Configuration

### SSL/TLS Setup

To enable HTTPS:

1. Generate SSL certificates:

```bash
sudo certbot certonly --standalone -d omnisight.yourdomain.com
```

2. Update Nginx configuration in `/services/frontend/nginx.conf`:

```nginx
server {
    listen 443 ssl;
    server_name omnisight.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/omnisight.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/omnisight.yourdomain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy to API Gateway
    location /api {
        proxy_pass http://api-gateway:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Proxy to WebSocket
    location /ws {
        proxy_pass http://metadata-events:3104;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Serve static files
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name omnisight.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

3. Restart Nginx:

```bash
docker-compose restart frontend
```

### JWT Configuration

Configure JWT settings in `/services/api-gateway/src/config/config.ts`:

```javascript
jwt: {
  // Secret key for signing tokens (use a strong random value)
  secret: 'your-secret-key-change-in-production',
  
  // Token expiration time
  expiresIn: '24h',
  
  // Refresh token settings
  refreshToken: {
    secret: 'your-refresh-secret-key-change-in-production',
    expiresIn: '7d'
  }
}
```

### Network Security

1. Configure firewall rules:

```bash
# Allow web access
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# SSH access
sudo ufw allow 22/tcp

# RTSP for cameras (if needed)
sudo ufw allow 554/tcp

# Enable firewall
sudo ufw enable
```

2. Use a private network for cameras when possible

## Performance Tuning

### Hardware Acceleration

To enable GPU acceleration for object detection:

1. Install NVIDIA drivers and CUDA:

```bash
sudo apt-get update
sudo apt-get install -y nvidia-driver-460 nvidia-cuda-toolkit
```

2. Update the `.env` file:

```
ENABLE_GPU=true
CUDA_VISIBLE_DEVICES=0
```

3. Restart the object detection service:

```bash
docker-compose restart object-detection
```

### Optimizing Camera Settings

For optimal performance:

1. Set appropriate resolution for each camera:
   - 1080p for main entrance and critical areas
   - 720p for general surveillance
   - Lower resolutions for less critical areas

2. Configure frame rates based on needs:
   - 15-30 fps for areas with high activity
   - 5-10 fps for general surveillance
   - 1-5 fps for static scenes (e.g., storage areas)

3. Use H.264 or H.265 encoding for bandwidth efficiency

### System Resource Allocation

Configure resource limits in `docker-compose.yml`:

```yaml
services:
  object-detection:
    # ...
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
  
  stream-ingestion:
    # ...
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## Backup & Recovery

### Automated Backup Configuration

Configure automated backups in `/services/api-gateway/src/config/config.ts`:

```javascript
backup: {
  // Backup schedule (cron format)
  schedule: '0 2 * * *', // Daily at 2 AM
  
  // Backup directory
  directory: '/backups',
  
  // Components to back up
  components: {
    database: true,
    config: true,
    events: true,
    thumbnails: true,
    recordings: false  // Often too large for regular backups
  },
  
  // Retention policy for backups
  retention: {
    count: 7,       // Keep last 7 backups
    days: 30        // Keep backups for 30 days
  }
}
```

### Manual Backup

To perform a manual backup:

```bash
# Back up database
docker-compose exec metadata-events npm run backup:database

# Back up configuration
docker-compose exec api-gateway npm run backup:config

# Back up events and thumbnails
docker-compose exec metadata-events npm run backup:events
```

### System Recovery

To restore from a backup:

1. Stop the services:

```bash
docker-compose down
```

2. Restore the database:

```bash
cat backup/database.sql | docker-compose exec -T postgres psql -U postgres omnisight
```

3. Restore configuration:

```bash
docker-compose exec api-gateway npm run restore:config -- --file=/backups/config_2025-03-02.json
```

4. Restart the services:

```bash
docker-compose up -d
```

## Scaling Strategies

### Vertical Scaling

Increase resources for existing services:

1. Update resource allocations in `docker-compose.yml`
2. Restart services with new allocations

### Horizontal Scaling

For larger deployments:

1. Use Docker Swarm or Kubernetes for orchestration
2. Configure load balancing for API Gateway
3. Add more worker nodes for object detection
4. Distribute database with replication

Example Kubernetes configuration is provided in `/kubernetes/` directory.

## Monitoring & Alerting

### System Monitoring

OmniSight includes a monitoring dashboard with:

- CPU, memory, and disk usage
- Service health status
- Camera connection status
- Event processing rates
- Storage usage trends

Access the monitoring dashboard at `/monitoring` in the web interface.

### Alert Configuration

Configure alerts in `/services/api-gateway/src/config/alerts.ts`:

```javascript
alerts: {
  // System health alerts
  system: {
    // CPU usage threshold (percentage)
    cpuThreshold: 90,
    
    // Memory usage threshold (percentage)
    memoryThreshold: 85,
    
    // Disk space threshold (percentage)
    diskThreshold: 90
  },
  
  // Camera alerts
  cameras: {
    // Alert when camera is offline for X seconds
    offlineThreshold: 60,
    
    // Alert when reconnection attempts exceed threshold
    reconnectionThreshold: 5
  },
  
  // Storage alerts
  storage: {
    // Alert when storage is almost full (percentage)
    fullThreshold: 85,
    
    // Alert when storage growth rate exceeds threshold (GB/day)
    growthRateThreshold: 50
  }
}
```

### Log Management

OmniSight logs are stored in:

- System logs: `/var/log/omnisight/`
- Container logs: viewable with `docker-compose logs`

Configure log rotation in `/etc/logrotate.d/omnisight`:

```
/var/log/omnisight/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root adm
    sharedscripts
    postrotate
        systemctl reload rsyslog >/dev/null 2>&1 || true
    endscript
}
```

## Troubleshooting

### Common Issues

#### Camera Connection Issues

**Problem**: Cameras showing as offline
**Solutions**:
- Verify network connectivity
- Check camera credentials
- Ensure RTSP port (554) is open
- Review logs: `docker-compose logs stream-ingestion`

#### Database Connection Issues

**Problem**: Services cannot connect to the database
**Solutions**:
- Check database service: `docker-compose ps postgres`
- Verify connection parameters in `.env`
- Check database logs: `docker-compose logs postgres`

#### Object Detection Performance

**Problem**: Slow or missed detections
**Solutions**:
- Enable GPU acceleration
- Reduce camera resolution or frame rate
- Increase worker threads
- Check resource allocation

#### WebSocket Connection Issues

**Problem**: Real-time updates not working
**Solutions**:
- Check WebSocket service: `docker-compose ps metadata-events`
- Verify Nginx proxy configuration for WebSockets
- Check browser console for connection errors

### Diagnostic Commands

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs -f [service]

# Check database connectivity
docker-compose exec postgres pg_isready

# View system resources
docker stats

# Test camera connectivity
docker-compose exec stream-ingestion npm run test:camera -- --ip=192.168.1.100 --username=admin --password=password
```

## Maintenance Tasks

### Routine Maintenance Checklist

#### Daily

- Check system dashboard for alerts
- Verify all cameras are online
- Monitor storage usage

#### Weekly

- Review system logs for errors
- Check backup status
- Verify recording retention policy enforcement

#### Monthly

- Update SSL certificates if needed
- Clean up temporary export files
- Review user accounts and permissions
- Check for software updates

### Service Maintenance

Restart individual services:

```bash
docker-compose restart [service]
```

Update service configuration:

1. Edit the configuration file
2. Restart the service:

```bash
docker-compose restart [service]
```

### System Updates

Update the OmniSight system:

```bash
# Pull latest changes
git pull

# Rebuild with new changes
docker-compose build

# Apply database migrations
docker-compose exec metadata-events npm run db:migrate

# Restart services
docker-compose up -d
```

## API Integration

### API Authentication

To authenticate with the API:

```bash
curl -X POST \
  http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
```

### API Examples

#### Get Camera List

```bash
curl -X GET \
  http://localhost:3000/api/cameras \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Create Event Webhook

```bash
curl -X POST \
  http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Security System Integration",
    "url": "https://your-system.com/webhook",
    "secret": "your-webhook-secret",
    "events": ["person", "vehicle", "motion"],
    "cameras": ["camera-id-1", "camera-id-2"]
  }'
```

### WebSocket Integration

Connect to the WebSocket API:

```javascript
const socket = new WebSocket('ws://localhost:3104/ws?token=YOUR_TOKEN');

socket.onopen = () => {
  console.log('Connected to OmniSight WebSocket');
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event received:', data);
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

For complete API documentation, see the [API Reference](api/rest-api-reference.md).

---

## Additional Resources

- [User Guide](user-guide.md)
- [API Reference](api/rest-api-reference.md)
- [Hardware Compatibility List](hardware-compatibility.md)
- [Troubleshooting FAQ](troubleshooting-faq.md)

For additional support, contact: support@omnisight.com