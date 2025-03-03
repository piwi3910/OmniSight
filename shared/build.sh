#!/bin/bash
# Script to build the shared library

echo "Building @omnisight/shared library..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Clean existing build
echo "Cleaning previous build..."
npm run clean

# Build the library
echo "Compiling TypeScript..."
npm run build

echo "Build completed successfully!"