import amqp from 'amqplib';
import config from '../config/config';
import logger from './logger';
import { processVideoFrame } from './detectionManager';

// RabbitMQ connection
let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

/**
 * Initialize RabbitMQ connection and channel
 */
export const initRabbitMQ = async (): Promise<void> => {
  try {
    // Create connection URL
    const { host, port, username, password } = config.rabbitmq;
    const connectionUrl = `amqp://${username}:${password}@${host}:${port}`;
    
    // Connect to RabbitMQ
    connection = await amqp.connect(connectionUrl);
    logger.info('Connected to RabbitMQ');
    
    // Create channel
    channel = await connection.createChannel();
    logger.info('Created RabbitMQ channel');
    
    // Set up exchanges
    await channel.assertExchange(config.rabbitmq.frameExchange, 'topic', { durable: true });
    await channel.assertExchange(config.rabbitmq.detectionExchange, 'topic', { durable: true });
    logger.info('RabbitMQ exchanges set up');
    
    // Set up queue for video frames
    const queueName = 'detection.frames';
    await channel.assertQueue(queueName, { durable: true });
    
    // Bind queue to exchange with routing pattern for all cameras and streams
    await channel.bindQueue(queueName, config.rabbitmq.frameExchange, 'camera.#');
    logger.info(`Bound queue ${queueName} to exchange ${config.rabbitmq.frameExchange}`);
    
    // Set prefetch count to limit the number of unacknowledged messages
    await channel.prefetch(10);
    
    // Consume messages
    await channel.consume(queueName, async (msg) => {
      if (!msg) return;
      
      try {
        // Extract routing key parts
        const routingKey = msg.fields.routingKey;
        const parts = routingKey.split('.');
        
        if (parts.length >= 4 && parts[0] === 'camera' && parts[2] === 'stream') {
          const cameraId = parts[1];
          const streamId = parts[3];
          
          // Get timestamp from message properties or use current time
          const timestamp = msg.properties.timestamp 
            ? new Date(msg.properties.timestamp) 
            : new Date();
          
          // Process video frame for object detection
          await processVideoFrame(cameraId, streamId, msg.content, timestamp);
        }
        
        // Acknowledge message
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing message:', error);
        
        // Reject message and requeue if it's a temporary error
        channel.nack(msg, false, true);
      }
    });
    
    logger.info(`Started consuming messages from queue ${queueName}`);
    
    // Handle connection close
    connection.on('close', () => {
      logger.error('RabbitMQ connection closed');
      // Attempt to reconnect after delay
      setTimeout(initRabbitMQ, 5000);
    });
    
    // Handle errors
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
      // Connection will close and trigger the 'close' event
    });
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error);
    // Attempt to reconnect after delay
    setTimeout(initRabbitMQ, 5000);
  }
};

/**
 * Publish a detection event to RabbitMQ
 */
export const publishDetectionEvent = async (
  cameraId: string,
  streamId: string,
  detections: any[],
  timestamp: Date,
  frameBuffer?: Buffer
): Promise<boolean> => {
  try {
    if (!channel) {
      logger.error('Cannot publish detection event: RabbitMQ channel not initialized');
      return false;
    }
    
    const routingKey = `detection.${cameraId}.${streamId}`;
    
    // Create message
    const message = {
      cameraId,
      streamId,
      timestamp: timestamp.toISOString(),
      detections,
      // Include frame buffer if provided (base64 encoded)
      frame: frameBuffer ? frameBuffer.toString('base64') : undefined
    };
    
    // Publish message
    const result = channel.publish(
      config.rabbitmq.detectionExchange,
      routingKey,
      Buffer.from(JSON.stringify(message))
    );
    
    if (!result) {
      logger.warn(`Detection event for ${cameraId}/${streamId} was not published`);
    }
    
    return result;
  } catch (error) {
    logger.error(`Error publishing detection event for ${cameraId}/${streamId}:`, error);
    return false;
  }
};

/**
 * Close RabbitMQ connection
 */
export const closeRabbitMQ = async (): Promise<void> => {
  try {
    if (channel) {
      await channel.close();
      logger.info('Closed RabbitMQ channel');
    }
    
    if (connection) {
      await connection.close();
      logger.info('Closed RabbitMQ connection');
    }
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
  } finally {
    channel = null;
    connection = null;
  }
};