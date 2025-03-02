FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Create recordings directory
RUN mkdir -p /app/recordings

# Expose port
EXPOSE 3002

# Start the service
CMD ["npm", "start"]