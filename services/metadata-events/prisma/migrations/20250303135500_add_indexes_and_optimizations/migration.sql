-- This migration adds necessary indexes and optimizations to improve query performance

-- Add indexes for commonly queried fields in Camera table
CREATE INDEX IF NOT EXISTS "Camera_status_idx" ON "Camera"("status");
CREATE INDEX IF NOT EXISTS "Camera_ipAddress_idx" ON "Camera"("ipAddress");

-- Add indexes for Event filtering and searching
CREATE INDEX IF NOT EXISTS "Event_timestamp_idx" ON "Event"("timestamp");
CREATE INDEX IF NOT EXISTS "Event_eventType_idx" ON "Event"("eventType");
CREATE INDEX IF NOT EXISTS "Event_recordingId_timestamp_idx" ON "Event"("recordingId", "timestamp");
CREATE INDEX IF NOT EXISTS "Event_cameraId_timestamp_idx" ON "Event"("cameraId", "timestamp");

-- Add indexes for Recording searches
CREATE INDEX IF NOT EXISTS "Recording_cameraId_startTime_idx" ON "Recording"("cameraId", "startTime");
CREATE INDEX IF NOT EXISTS "Recording_status_idx" ON "Recording"("status");
CREATE INDEX IF NOT EXISTS "Recording_startTime_idx" ON "Recording"("startTime");

-- Add indexes for Segment filtering
CREATE INDEX IF NOT EXISTS "Segment_recordingId_startTime_idx" ON "Segment"("recordingId", "startTime");
CREATE INDEX IF NOT EXISTS "Segment_startTime_idx" ON "Segment"("startTime");

-- Add index for DetectedObject filtering by object type
CREATE INDEX IF NOT EXISTS "DetectedObject_objectType_idx" ON "DetectedObject"("objectType");
CREATE INDEX IF NOT EXISTS "DetectedObject_confidence_idx" ON "DetectedObject"("confidence");

-- Add indexes for Stream status and timestamps
CREATE INDEX IF NOT EXISTS "Stream_cameraId_status_idx" ON "Stream"("cameraId", "status");
CREATE INDEX IF NOT EXISTS "Stream_startedAt_idx" ON "Stream"("startedAt");

-- Add indexes for User management
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- Add indexes for Notification filtering
CREATE INDEX IF NOT EXISTS "Notification_userId_status_idx" ON "Notification"("userId", "status");
CREATE INDEX IF NOT EXISTS "Notification_status_idx" ON "Notification"("status");
CREATE INDEX IF NOT EXISTS "Notification_sentAt_idx" ON "Notification"("sentAt");

-- Add indexes for RetentionPolicy
CREATE INDEX IF NOT EXISTS "RetentionPolicy_cameraId_isActive_idx" ON "RetentionPolicy"("cameraId", "isActive");
CREATE INDEX IF NOT EXISTS "RetentionPolicy_priority_idx" ON "RetentionPolicy"("priority");

-- Add index for SystemSettings lookup
CREATE INDEX IF NOT EXISTS "SystemSettings_category_idx" ON "SystemSettings"("category");

-- Add cascading delete rules

-- When a camera is deleted, cascade to related streams and recordings
ALTER TABLE "Stream" 
DROP CONSTRAINT IF EXISTS "Stream_cameraId_fkey",
ADD CONSTRAINT "Stream_cameraId_fkey" 
FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Recording" 
DROP CONSTRAINT IF EXISTS "Recording_cameraId_fkey",
ADD CONSTRAINT "Recording_cameraId_fkey" 
FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- When a recording is deleted, cascade to segments and events
ALTER TABLE "Segment" 
DROP CONSTRAINT IF EXISTS "Segment_recordingId_fkey",
ADD CONSTRAINT "Segment_recordingId_fkey" 
FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" 
DROP CONSTRAINT IF EXISTS "Event_recordingId_fkey",
ADD CONSTRAINT "Event_recordingId_fkey" 
FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- When an event is deleted, cascade to detected objects
ALTER TABLE "DetectedObject" 
DROP CONSTRAINT IF EXISTS "DetectedObject_eventId_fkey",
ADD CONSTRAINT "DetectedObject_eventId_fkey" 
FOREIGN KEY ("eventId") REFERENCES "Event"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- When a user is deleted, cascade to notifications
ALTER TABLE "Notification" 
DROP CONSTRAINT IF EXISTS "Notification_userId_fkey",
ADD CONSTRAINT "Notification_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Add database configuration for better performance
COMMENT ON DATABASE "postgres" IS 'Configured for OmniSight video surveillance system';

-- Optimize for read-heavy workload with appropriate settings
ALTER SYSTEM SET shared_buffers = '256MB';  -- 25% of RAM for small to medium servers
ALTER SYSTEM SET effective_cache_size = '768MB';  -- 75% of RAM for small to medium servers
ALTER SYSTEM SET work_mem = '16MB';  -- Helps with sorting and complex queries
ALTER SYSTEM SET maintenance_work_mem = '64MB';  -- Helps with VACUUM and index creation
ALTER SYSTEM SET random_page_cost = 1.1;  -- Assuming SSD storage
ALTER SYSTEM SET effective_io_concurrency = 200;  -- Good for SSD
ALTER SYSTEM SET max_worker_processes = 8;  -- Adjust based on CPU cores
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;  -- Adjust based on CPU cores
ALTER SYSTEM SET max_parallel_workers = 8;  -- Adjust based on CPU cores
ALTER SYSTEM SET wal_buffers = '16MB';  -- Helps with transaction throughput