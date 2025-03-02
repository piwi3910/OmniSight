import prisma from '../prisma/client';
import logger from '../utils/logger';

// Default retention configuration
const DEFAULT_RETENTION_CONFIG = {
  recordings: {
    days: 30, // Keep recordings for 30 days by default
    minSpaceGB: 10, // Keep at least 10GB free
  },
  events: {
    days: 60, // Keep events for 60 days by default
  }
};

/**
 * Service class for data retention business logic
 */
export class RetentionService {
  private config: typeof DEFAULT_RETENTION_CONFIG;
  private isRunning: boolean = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(config?: typeof DEFAULT_RETENTION_CONFIG) {
    this.config = config || DEFAULT_RETENTION_CONFIG;
    logger.info('Retention service initialized with config:', this.config);
  }

  /**
   * Start the retention service with periodic cleanup
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Retention service is already running');
      return;
    }

    logger.info('Starting retention service');
    this.isRunning = true;

    // Run immediately
    this.runCleanup();

    // Then schedule to run daily
    this.interval = setInterval(() => {
      this.runCleanup();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Stop the retention service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Retention service is not running');
      return;
    }

    logger.info('Stopping retention service');
    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Run the cleanup process
   */
  async runCleanup(): Promise<void> {
    try {
      logger.info('Running retention cleanup');

      // Run cleanup tasks in parallel
      await Promise.all([
        this.cleanupRecordings(),
        this.cleanupEvents()
      ]);

      logger.info('Retention cleanup completed successfully');
    } catch (error) {
      logger.error('Error running retention cleanup:', error);
    }
  }

  /**
   * Clean up old recordings based on retention policy
   */
  async cleanupRecordings(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.recordings.days);

      // Find recordings older than cutoff date
      const oldRecordings = await prisma.recording.findMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          status: 'COMPLETED'
        },
        select: {
          id: true
        }
      });

      if (oldRecordings.length === 0) {
        logger.info('No recordings found to clean up');
        return 0;
      }

      const recordingIds = oldRecordings.map(recording => recording.id);
      logger.info(`Found ${recordingIds.length} recordings to clean up`);

      // Delete associated segments first
      const deletedSegments = await prisma.segment.deleteMany({
        where: {
          recordingId: {
            in: recordingIds
          }
        }
      });

      // Delete associated events
      const deletedEvents = await prisma.event.deleteMany({
        where: {
          recordingId: {
            in: recordingIds
          }
        }
      });

      // Finally delete the recordings
      const deletedRecordings = await prisma.recording.deleteMany({
        where: {
          id: {
            in: recordingIds
          }
        }
      });

      logger.info(`Cleaned up ${deletedRecordings.count} recordings, ${deletedSegments.count} segments, and ${deletedEvents.count} events`);
      return deletedRecordings.count;
    } catch (error) {
      logger.error('Error cleaning up recordings:', error);
      throw error;
    }
  }

  /**
   * Clean up old events based on retention policy
   */
  async cleanupEvents(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.events.days);

      // Find events that are not associated with recordings and are older than cutoff date
      const orphanedEvents = await prisma.event.findMany({
        where: {
          recordingId: {
            equals: undefined
          },
          createdAt: {
            lt: cutoffDate
          }
        },
        select: {
          id: true
        }
      });

      if (orphanedEvents.length === 0) {
        logger.info('No orphaned events found to clean up');
        return 0;
      }

      const eventIds = orphanedEvents.map(event => event.id);
      logger.info(`Found ${eventIds.length} orphaned events to clean up`);

      // Delete associated detected objects first
      const deletedObjects = await prisma.detectedObject.deleteMany({
        where: {
          eventId: {
            in: eventIds
          }
        }
      });

      // Delete the events
      const deletedEvents = await prisma.event.deleteMany({
        where: {
          id: {
            in: eventIds
          }
        }
      });

      logger.info(`Cleaned up ${deletedEvents.count} orphaned events and ${deletedObjects.count} detected objects`);
      return deletedEvents.count;
    } catch (error) {
      logger.error('Error cleaning up events:', error);
      throw error;
    }
  }

  /**
   * Update retention configuration
   */
  updateConfig(newConfig: Partial<typeof DEFAULT_RETENTION_CONFIG>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    logger.info('Retention configuration updated:', this.config);
  }

  /**
   * Get current retention configuration
   */
  getConfig(): typeof DEFAULT_RETENTION_CONFIG {
    return { ...this.config };
  }
}

// Export a singleton instance
export const retentionService = new RetentionService();

// Backward compatibility with the previous manager
export const initRetentionManager = () => {
  retentionService.start();
};