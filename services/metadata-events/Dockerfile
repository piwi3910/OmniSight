FROM node:18-alpine

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

# Create thumbnails directory
RUN mkdir -p /app/thumbnails

# Expose port
EXPOSE 3004

# Start the service
CMD ["npm", "start"]