#!/bin/bash

# Start OmniSight Application locally while using Docker for PostgreSQL and RabbitMQ

echo "Starting OmniSight Application..."
echo "Using PostgreSQL and RabbitMQ from Docker"

# Check if needed containers are running
POSTGRES_RUNNING=$(docker ps | grep omnisight-postgres | wc -l)
RABBITMQ_RUNNING=$(docker ps | grep omnisight-rabbitmq | wc -l)

if [ $POSTGRES_RUNNING -eq 0 ] || [ $RABBITMQ_RUNNING -eq 0 ]; then
  echo "Error: PostgreSQL and/or RabbitMQ containers are not running"
  echo "Please ensure both containers are running before starting the application"
  exit 1
fi

echo "PostgreSQL and RabbitMQ containers detected and running"

# Create an .env file with correct settings
cat > .env << EOL
# OmniSight Environment Variables

# Node.js
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=omnisight

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_MANAGEMENT_PORT=15672

# API Gateway
API_GATEWAY_PORT=8000
JWT_SECRET=omnisight_jwt_secret
JWT_EXPIRATION=1h
REFRESH_TOKEN_SECRET=omnisight_refresh_token_secret
REFRESH_TOKEN_EXPIRATION=7d

# Stream Ingestion Service
STREAM_INGESTION_PORT=3001

# Recording Service
RECORDING_PORT=3002
SEGMENT_DURATION=600 # 10 minutes in seconds

# Object Detection Service
OBJECT_DETECTION_PORT=3003
DETECTION_INTERVAL=1000 # milliseconds
MIN_CONFIDENCE=0.6

# Metadata & Events Service
METADATA_EVENTS_PORT=3004

# Frontend Service
FRONTEND_PORT=3000
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_WS_URL=ws://localhost:8000/api/v1/ws

# Storage Paths
RECORDINGS_PATH=./recordings
THUMBNAILS_PATH=./thumbnails
EOL

echo "Environment file created"

# Create storage directories
mkdir -p ./recordings
mkdir -p ./thumbnails
echo "Storage directories created"

# Start each service in a new process
echo "Starting services..."

# Start Metadata & Events Service (with Prisma)
echo "Starting Metadata & Events Service with Prisma..."
cd services/metadata-events
npm run prisma-dev > ../../metadata-events.log 2>&1 &
METADATA_PID=$!
cd ../..

# Start API Gateway
echo "Starting API Gateway..."
cd services/api-gateway
npm run dev > ../../api-gateway.log 2>&1 &
API_GATEWAY_PID=$!
cd ../..

# Give the API gateway and metadata services time to start
sleep 5

# Start Stream Ingestion
echo "Starting Stream Ingestion Service..."
cd services/stream-ingestion
npm run dev > ../../stream-ingestion.log 2>&1 &
STREAM_INGESTION_PID=$!
cd ../..

# Start Recording Service
echo "Starting Recording Service..."
cd services/recording
npm run dev > ../../recording.log 2>&1 &
RECORDING_PID=$!
cd ../..

# Start Object Detection Service
echo "Starting Object Detection Service..."
cd services/object-detection
npm run dev > ../../object-detection.log 2>&1 &
OBJECT_DETECTION_PID=$!
cd ../..

# Start Frontend
echo "Starting Frontend Service..."
cd services/frontend
npm run start > ../../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

echo "All services started!"
echo "OmniSight application should be accessible at http://localhost:3000"
echo "API Gateway is available at http://localhost:8000"
echo ""
echo "Service log files:"
echo "- metadata-events.log"
echo "- api-gateway.log"
echo "- stream-ingestion.log"
echo "- recording.log"
echo "- object-detection.log"
echo "- frontend.log"
echo ""
echo "Process IDs:"
echo "- Metadata & Events: $METADATA_PID"
echo "- API Gateway: $API_GATEWAY_PID"
echo "- Stream Ingestion: $STREAM_INGESTION_PID"
echo "- Recording: $RECORDING_PID"
echo "- Object Detection: $OBJECT_DETECTION_PID"
echo "- Frontend: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap the SIGINT signal and stop all services
function cleanup {
  echo "Stopping all services..."
  kill $METADATA_PID $API_GATEWAY_PID $STREAM_INGESTION_PID $RECORDING_PID $OBJECT_DETECTION_PID $FRONTEND_PID 2>/dev/null
  echo "All services stopped"
  exit 0
}

trap cleanup SIGINT

# Wait for user to stop
while true; do
  sleep 1
done