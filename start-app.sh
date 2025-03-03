#!/bin/bash
# Script to start all services in development mode

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting OmniSight Services${NC}"
echo "==========================="

# Define root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES_DIR="$ROOT_DIR/services"

# Check for running services to avoid port conflicts
echo -e "${YELLOW}Checking for running services...${NC}"
PORT_CHECK=$(netstat -tuln 2>/dev/null | grep -E ':(3001|3002|3003|3004|8000)' || echo "")

if [ ! -z "$PORT_CHECK" ]; then
  echo -e "${RED}Warning: Some ports are already in use:${NC}"
  echo "$PORT_CHECK"
  echo -e "You may need to stop existing services before starting new ones."
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborting startup."
    exit 1
  fi
fi

# Define services with their respective commands
declare -A services=(
  ["api-gateway"]="cd $SERVICES_DIR/api-gateway && npm run dev"
  ["metadata-events"]="cd $SERVICES_DIR/metadata-events && npm run dev"
  ["stream-ingestion"]="cd $SERVICES_DIR/stream-ingestion && npm run dev"
  ["recording"]="cd $SERVICES_DIR/recording && npm run dev"
  ["object-detection"]="cd $SERVICES_DIR/object-detection && npm run dev"
)

# Function to start a service in a new terminal
start_service() {
  local service_name=$1
  local command=$2
  
  echo -e "${CYAN}Starting $service_name...${NC}"
  
  # Open a new terminal with a specific title and run the command
  # Different commands for different operating systems
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e "tell app \"Terminal\" to do script \"echo -e \\\"${YELLOW}$service_name${NC}\\\"; $command\""
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux: Attempt to detect the terminal
    if command -v gnome-terminal &> /dev/null; then
      gnome-terminal --title="$service_name" -- bash -c "$command; exec bash"
    elif command -v konsole &> /dev/null; then
      konsole --new-tab -p tabtitle="$service_name" -e bash -c "$command; exec bash"
    elif command -v xterm &> /dev/null; then
      xterm -title "$service_name" -e "bash -c '$command; exec bash'" &
    else
      # Fallback: Run in background and log to file
      echo -e "${YELLOW}No supported terminal found. Running $service_name in background.${NC}"
      bash -c "$command > logs/$service_name.log 2>&1" &
    fi
  else
    echo -e "${RED}Unsupported operating system. Please run services manually.${NC}"
    echo -e "Command for $service_name: ${CYAN}$command${NC}"
    return 1
  fi
  
  echo -e "${GREEN}Started $service_name${NC}"
  return 0
}

# Create logs directory if it doesn't exist
mkdir -p "$ROOT_DIR/logs"

# Start each service
for service in "${!services[@]}"; do
  start_service "$service" "${services[$service]}"
  # Add a slight delay to prevent all terminals from opening at once
  sleep 1
done

# Start frontend separately (React development server)
echo -e "${CYAN}Starting frontend...${NC}"
cd "$SERVICES_DIR/frontend" && npm start &

echo -e "${GREEN}All services started!${NC}"
echo "==========================="
echo -e "API Gateway:        ${CYAN}http://localhost:8000${NC}"
echo -e "Frontend:           ${CYAN}http://localhost:3000${NC}"
echo -e "Metadata & Events:  ${CYAN}http://localhost:3004${NC}"
echo -e "Stream Ingestion:   ${CYAN}http://localhost:3001${NC}"
echo -e "Recording:          ${CYAN}http://localhost:3002${NC}"
echo -e "Object Detection:   ${CYAN}http://localhost:3003${NC}"
echo "==========================="
echo -e "To stop all services, use: ${YELLOW}pkill -f 'npm run dev'${NC}"