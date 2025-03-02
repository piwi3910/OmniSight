#!/bin/bash

echo "Starting Prisma ORM test for metadata-events service"

# Create the thumbnails directory if it doesn't exist
mkdir -p ./thumbnails
echo "Created thumbnails directory"

# Check if Prisma client is generated
if [ ! -d "./node_modules/.prisma/client" ]; then
  echo "Generating Prisma client..."
  npx prisma generate
fi

# Check database connection using Prisma
echo "Testing database connection via Prisma..."
npx prisma db pull --force

if [ $? -ne 0 ]; then
  echo "Error connecting to database. Please make sure the PostgreSQL Docker container is running and accessible."
  exit 1
fi

echo "Database connection successful!"

# Push the schema to the database
echo "Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

# Seed the database
echo "Seeding the database with initial data..."
npx prisma db seed

# Run the application with Prisma
echo "Starting the application with Prisma..."
npx ts-node-dev src/startApp.ts