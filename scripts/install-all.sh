#!/bin/bash

# OmniSight - Install dependencies for all services

# Set script to exit on error
set -e

# Print colored output
print_message() {
  echo -e "\e[1;34m>> $1\e[0m"
}

print_success() {
  echo -e "\e[1;32m>> $1\e[0m"
}

print_error() {
  echo -e "\e[1;31m>> $1\e[0m"
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  print_error "npm is not installed. Please install Node.js and npm first."
  exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  print_message "Creating .env file from .env.example..."
  cp .env.example .env
  print_success ".env file created. You may want to edit it with your own values."
fi

# Install dependencies for each service
install_service_deps() {
  local service=$1
  print_message "Installing dependencies for $service service..."
  cd services/$service
  npm install
  cd ../..
  print_success "$service service dependencies installed."
}

# Main script
print_message "Starting OmniSight dependencies installation..."

# Create directories if they don't exist
mkdir -p services/stream-ingestion/data
mkdir -p services/recording/recordings
mkdir -p services/metadata-events/thumbnails

# Install dependencies for each service
install_service_deps "stream-ingestion"
install_service_deps "recording"
install_service_deps "object-detection"
install_service_deps "metadata-events"
install_service_deps "api-gateway"
install_service_deps "frontend"

print_success "All dependencies installed successfully!"
print_message "You can now start the services using Docker Compose:"
print_message "  docker-compose up -d"