import { Request, Response, Router } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import amqp from 'amqplib';
import { 
  createHealthCheckManager,
  HealthStatus,
  commonDependencies
} from '@omnisight/shared';
import config from '../config/config';
import logger from './logger';

// Create Prisma client for database checks
const prisma = new PrismaClient();

/**
 * Initialize health check system for API Gateway
 */
export const initializeHealthCheck = () => {
  // Create health check manager
  const healthCheckManager = createHealthCheckManager({
    serviceName: 'api-gateway',
    version: config.version,
    logger,
    checkInterval: 30000, // Check every 30 seconds
    dependencies: [
      // Database health check
      commonDependencies.createDatabaseCheck({
        name: 'database',
        critical: true,
        checkFn: async () => {
          // Check database connection by querying a simple table
          await prisma.$queryRaw`SELECT 1`;
        }
      }),
      
      // RabbitMQ health check
      commonDependencies.createRabbitMQCheck({
        name: 'rabbitmq',
        critical: true,
        checkFn: async () => {
          // Check RabbitMQ connection
          const connection = await amqp.connect(config.rabbitmq.url);
          await connection.close();
        }
      }),
      
      // Service health checks for each microservice
      commonDependencies.createServiceCheck({
        name: 'metadata-events-service',
        url: config.services.metadataEvents.url,
        timeoutMs: 3000,
        critical: true
      }),
      
      commonDependencies.createServiceCheck({
        name: 'stream-ingestion-service',
        url: config.services.streamIngestion.url,
        timeoutMs: 3000,
        critical: true
      }),
      
      commonDependencies.createServiceCheck({
        name: 'recording-service',
        url: config.services.recording.url,
        timeoutMs: 3000,
        critical: true
      }),
      
      commonDependencies.createServiceCheck({
        name: 'object-detection-service',
        url: config.services.objectDetection.url,
        timeoutMs: 3000,
        critical: false // Not critical at startup
      })
    ]
  });
  
  // Start monitoring
  healthCheckManager.startMonitoring();
  
  // Return router for health check endpoints
  return healthCheckManager.getHealthCheckRouter();
};

/**
 * Creates a middleware that checks the health of all services
 * before proxying requests
 */
export const createServiceHealthMiddleware = () => {
  return async (req: Request, res: Response, next: Function) => {
    const service = req.originalUrl.split('/')[1];
    
    // Map service path to service URL
    const serviceUrls: Record<string, string> = {
      'metadata': config.services.metadataEvents.url,
      'events': config.services.metadataEvents.url,
      'cameras': config.services.metadataEvents.url,
      'streams': config.services.streamIngestion.url,
      'recordings': config.services.recording.url,
      'detection': config.services.objectDetection.url
    };
    
    const serviceUrl = serviceUrls[service];
    
    if (serviceUrl) {
      try {
        // Perform a quick health check on the target service
        const response = await axios.get(`${serviceUrl}/health/liveness`, {
          timeout: 1000 // Short timeout
        });
        
        if (response.data.status === HealthStatus.ERROR) {
          logger.error(`Service ${service} is reporting error status`);
          return res.status(503).json({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: `The ${service} service is currently unavailable`
            }
          });
        }
        
        // Continue with the request if service is OK or degraded
        next();
      } catch (error) {
        logger.error(`Health check failed for service ${service}:`, error);
        
        return res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: `The ${service} service is currently unavailable`
          }
        });
      }
    } else {
      // No service health check needed, continue
      next();
    }
  };
};