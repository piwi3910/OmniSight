#!/bin/bash
# Script to build the shared library and link it to all services

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}OmniSight Shared Library Installation${NC}"
echo "======================================="

# Define root directory and services directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED_DIR="$ROOT_DIR/shared"
SERVICES_DIR="$ROOT_DIR/services"

# Build the shared library
echo -e "${YELLOW}Building shared library...${NC}"
cd "$SHARED_DIR" || { echo -e "${RED}Error: Could not find shared directory at $SHARED_DIR${NC}"; exit 1; }

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies for shared library..."
  npm install || { echo -e "${RED}Error: Failed to install dependencies for shared library${NC}"; exit 1; }
fi

# Clean and build
npm run clean && npm run build || { echo -e "${RED}Error: Failed to build shared library${NC}"; exit 1; }

echo -e "${GREEN}Shared library built successfully!${NC}"

# Create a list of services
services=("api-gateway" "frontend" "metadata-events" "object-detection" "recording" "stream-ingestion")

# Install the shared library in each service
for service in "${services[@]}"; do
  SERVICE_DIR="$SERVICES_DIR/$service"
  
  if [ ! -d "$SERVICE_DIR" ]; then
    echo -e "${RED}Warning: Service directory not found: $SERVICE_DIR${NC}"
    continue
  fi
  
  echo -e "${YELLOW}Installing shared library in $service...${NC}"
  cd "$SERVICE_DIR" || { echo -e "${RED}Error: Could not enter service directory $SERVICE_DIR${NC}"; continue; }
  
  # Check if package.json exists
  if [ ! -f "package.json" ]; then
    echo -e "${RED}Warning: package.json not found in $service${NC}"
    continue
  fi
  
  # Add the shared library as a dependency
  # First, check if it's already a dependency
  if grep -q '"@omnisight/shared"' package.json; then
    echo "Shared library is already a dependency in $service"
  else
    echo "Adding shared library as a dependency in $service..."
    # Use npm to add the dependency (this will update package.json)
    npm install --save $SHARED_DIR || { echo -e "${RED}Error: Failed to add shared library as dependency in $service${NC}"; continue; }
  fi
  
  echo -e "${GREEN}Shared library installed successfully in $service!${NC}"
done

echo -e "${GREEN}Installation complete!${NC}"
echo "======================================="
echo -e "To use the shared library in a service, import it like this:"
echo -e "${YELLOW}import { WebSocketManager, ErrorCode, ApiError } from '@omnisight/shared';${NC}"