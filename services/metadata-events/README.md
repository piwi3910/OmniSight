# Metadata & Events Service

This service is responsible for managing metadata, events, recordings, and camera information for the OmniSight platform.

## Recent Migration from Sequelize to Prisma ORM

This service has been migrated from Sequelize to Prisma ORM to improve type safety, developer experience, and maintainability.

### Key Benefits of Prisma

- **Type Safety**: Full TypeScript integration with proper type definitions
- **Simplified API**: More intuitive and cleaner database access code
- **Improved Maintainability**: Clearer separation of concerns
- **Migration Support**: Better schema management through Prisma Migrate
- **Developer Experience**: Modern tooling and better error handling

## Architecture

The service follows a clean architecture pattern:

- **Repository Layer**: Handles direct database operations with Prisma
- **Service Layer**: Contains business logic
- **Controller Layer**: Handles HTTP requests and responses

## Database Schema

The database schema is defined in `prisma/schema.prisma` and includes the following models:

- **Camera**: Information about cameras (status, connection details, etc.)
- **Stream**: Streaming sessions from cameras
- **Recording**: Video recordings
- **Segment**: Fragments of a recording
- **Event**: Detection events (motion, object detection, etc.)
- **DetectedObject**: Objects detected in events
- **User**: User accounts

## Getting Started

### Prerequisites

- Node.js 14+
- PostgreSQL 12+

### Environment Setup

Create a `.env` file in the service root with:

```
# Database connection
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/omnisight?schema=public"

# Service configuration
PORT=3004
THUMBNAILS_PATH=./thumbnails
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npm run migrate
```

### Running the Service

```bash
# Development with Prisma
npm run prisma-dev

# Development with legacy models (transitional)
npm run dev

# Production
npm run build
npm start
```

### Exploring the Database

Prisma includes a database GUI explorer:

```bash
npm run studio
```

## API Endpoints

### Events

- `GET /api/events` - Get all events (with filtering and pagination)
- `GET /api/events/:id` - Get a specific event
- `POST /api/events` - Create a new event
- `PUT /api/events/:id` - Update an event
- `DELETE /api/events/:id` - Delete an event
- `GET /api/cameras/:cameraId/events` - Get events for a specific camera
- `GET /api/recordings/:recordingId/events` - Get events for a specific recording

### Cameras

- `GET /api/cameras` - Get all cameras
- `GET /api/cameras/:id` - Get a specific camera
- `POST /api/cameras` - Register a new camera
- `PUT /api/cameras/:id` - Update a camera
- `DELETE /api/cameras/:id` - Delete a camera

### Recordings

- `GET /api/recordings` - Get all recordings
- `GET /api/recordings/:id` - Get a specific recording
- `POST /api/recordings` - Create a new recording
- `PUT /api/recordings/:id` - Update a recording
- `DELETE /api/recordings/:id` - Delete a recording
- `GET /api/cameras/:cameraId/recordings` - Get recordings for a specific camera

## WebSocket Events

The service uses Socket.IO to broadcast real-time events:

- `camera_events` - Events from a specific camera
- `system_notifications` - System-wide notifications

## Development

### Adding New Features

1. Update the Prisma schema if needed (`prisma/schema.prisma`)
2. Run migration: `npx prisma migrate dev --name feature_name`
3. Create/update repositories in `src/repositories/`
4. Create/update services in `src/services/`
5. Create/update controllers in `src/controllers/`
6. Add routes in `src/routes/`

### Testing

For manual testing, you can use the test endpoint:

```
GET /api/test-prisma