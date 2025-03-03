#!/bin/bash
# Main installation script for the OmniSight system

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}OmniSight Installation${NC}"
echo "======================="

# Define root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"

# Step 1: Build and install shared library
echo -e "${YELLOW}Step 1: Building shared library...${NC}"
$SCRIPTS_DIR/install-shared.sh
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to build shared library. Aborting installation.${NC}"
  exit 1
fi
echo -e "${GREEN}Shared library built and installed successfully.${NC}"

# Step 2: Install dependencies for each service
echo -e "${YELLOW}Step 2: Installing dependencies for all services...${NC}"

# List of services
services=("api-gateway" "frontend" "metadata-events" "object-detection" "recording" "stream-ingestion")

for service in "${services[@]}"; do
  SERVICE_DIR="$ROOT_DIR/services/$service"
  
  if [ ! -d "$SERVICE_DIR" ]; then
    echo -e "${RED}Warning: Service directory not found: $SERVICE_DIR${NC}"
    continue
  fi
  
  echo -e "${YELLOW}Installing dependencies for $service...${NC}"
  cd "$SERVICE_DIR" || { echo -e "${RED}Error: Could not enter service directory $SERVICE_DIR${NC}"; continue; }
  
  # Check if package.json exists
  if [ ! -f "package.json" ]; then
    echo -e "${RED}Warning: package.json not found in $service${NC}"
    continue
  fi
  
  # Install dependencies
  npm install || { echo -e "${RED}Error: Failed to install dependencies for $service${NC}"; continue; }
  
  echo -e "${GREEN}Dependencies installed successfully for $service!${NC}"
done

# Step 3: Set up environment variables
echo -e "${YELLOW}Step 3: Setting up environment variables...${NC}"
if [ ! -f "$ROOT_DIR/.env" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    echo "Creating .env file from .env.example..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo -e "${GREEN}Environment file created. Please review and modify .env as needed.${NC}"
  else
    echo -e "${RED}Warning: .env.example not found. Please create .env file manually.${NC}"
  fi
else
  echo ".env file already exists."
fi

# Step 4: Install and set up database
echo -e "${YELLOW}Step 4: Setting up database...${NC}"
cd "$ROOT_DIR/services/metadata-events" || { echo -e "${RED}Error: Could not find metadata-events service${NC}"; exit 1; }

# Run Prisma migration and seed
if command -v npx &> /dev/null; then
  echo "Running Prisma migrations..."
  npx prisma migrate dev --name initial || { echo -e "${RED}Error: Failed to run Prisma migrations${NC}"; }
  
  echo "Seeding database..."
  npx prisma db seed || { echo -e "${RED}Error: Failed to seed database${NC}"; }
else
  echo -e "${RED}Warning: npx not found. Please run Prisma migrations manually:${NC}"
  echo "cd services/metadata-events && npx prisma migrate dev && npx prisma db seed"
fi

# Step 5: Build services
echo -e "${YELLOW}Step 5: Building services...${NC}"
for service in "${services[@]}"; do
  SERVICE_DIR="$ROOT_DIR/services/$service"
  
  if [ ! -d "$SERVICE_DIR" ]; then
    continue
  fi
  
  echo -e "${YELLOW}Building $service...${NC}"
  cd "$SERVICE_DIR" || continue
  
  # Build the service
  npm run build || { echo -e "${RED}Error: Failed to build $service${NC}"; continue; }
  
  echo -e "${GREEN}Built $service successfully!${NC}"
done

# Step 6: Set up Docker environment (if needed)
echo -e "${YELLOW}Step 6: Setting up Docker environment...${NC}"
if command -v docker-compose &> /dev/null; then
  echo "Checking Docker Compose configuration..."
  cd "$ROOT_DIR" || exit 1
  
  # Check if Docker Compose file exists
  if [ -f "docker-compose.yml" ]; then
    echo "Docker Compose file found. You can start the system with:"
    echo -e "${YELLOW}cd $ROOT_DIR && docker-compose up -d${NC}"
  else
    echo -e "${RED}Warning: docker-compose.yml not found.${NC}"
  fi
else
  echo -e "${RED}Warning: docker-compose not found. Please install Docker and Docker Compose to run the system in containers.${NC}"
fi

echo -e "${GREEN}Installation completed!${NC}"
echo "======================="
echo -e "To start the development servers:"
echo -e "${YELLOW}cd $ROOT_DIR && ./start-app.sh${NC}"
echo ""
echo -e "To start with Docker:"
echo -e "${YELLOW}cd $ROOT_DIR && docker-compose up -d${NC}"