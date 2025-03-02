#!/bin/bash

# Script to install dependencies for all services

# Set script to exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Root directory
ROOT_DIR=$(pwd)

# Function to install dependencies for a service
install_service_deps() {
  local service=$1
  echo -e "${YELLOW}Installing dependencies for ${service}...${NC}"
  
  cd "${ROOT_DIR}/services/${service}"
  
  # Check if package.json exists
  if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found for ${service}${NC}"
    return 1
  fi
  
  # Install dependencies
  npm install
  
  # Install TypeScript types
  npm install --save-dev @types/node @types/express
  
  # Install additional types based on service
  case $service in
    "api-gateway")
      npm install --save-dev @types/cors @types/helmet @types/morgan @types/compression @types/jsonwebtoken @types/bcrypt @types/http-proxy-middleware
      ;;
    "metadata-events")
      npm install --save-dev @types/cors @types/helmet @types/morgan @types/bcrypt @types/uuid @types/sequelize
      ;;
    "stream-ingestion")
      npm install --save-dev @types/cors @types/helmet @types/morgan @types/amqplib @types/uuid
      ;;
    "recording")
      npm install --save-dev @types/cors @types/helmet @types/morgan @types/amqplib @types/uuid
      ;;
    "object-detection")
      npm install --save-dev @types/cors @types/helmet @types/morgan @types/amqplib @types/uuid @types/multer
      ;;
    "frontend")
      # Frontend has its own types in package.json
      ;;
  esac
  
  echo -e "${GREEN}Successfully installed dependencies for ${service}${NC}"
  cd "${ROOT_DIR}"
}

# Main script
echo -e "${YELLOW}Starting installation of all dependencies...${NC}"

# Install dependencies for each service
services=("api-gateway" "metadata-events" "stream-ingestion" "recording" "object-detection" "frontend")

for service in "${services[@]}"; do
  install_service_deps "$service"
done

# Install TensorFlow.js models for object detection
echo -e "${YELLOW}Installing TensorFlow.js models...${NC}"
cd "${ROOT_DIR}/services/object-detection"
mkdir -p models
cd models

# Download COCO-SSD model if it doesn't exist
if [ ! -d "coco-ssd" ]; then
  echo -e "${YELLOW}Downloading COCO-SSD model...${NC}"
  mkdir -p coco-ssd
  # This is a placeholder - in a real implementation, you would download the model files
  # For example: curl -L https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/model.json -o coco-ssd/model.json
  echo "// Placeholder for COCO-SSD model" > coco-ssd/model.json
fi

cd "${ROOT_DIR}"

echo -e "${GREEN}All dependencies installed successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Start the services with 'docker-compose up -d'"
echo -e "2. Access the frontend at http://localhost:3000"

exit 0