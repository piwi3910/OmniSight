import request from 'supertest';
import app from '../../src/index';
import axios from 'axios';

// Mock axios to avoid actual HTTP requests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Health Check Endpoints', () => {
  afterAll(async () => {
    // Close server after tests
    await new Promise<void>((resolve) => {
      app.close(() => {
        resolve();
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 and health status when all services are healthy', async () => {
      // Mock successful dependency checks
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/health/liveness')) {
          return Promise.resolve({
            data: {
              status: 'ok',
              service: 'test-service',
              timestamp: new Date().toISOString()
            }
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'api-gateway');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body.dependencies).toHaveProperty('metadata-events-service');
      expect(response.body.dependencies).toHaveProperty('stream-ingestion-service');
      expect(response.body.dependencies).toHaveProperty('recording-service');
      expect(response.body.dependencies).toHaveProperty('object-detection-service');
    });

    it('should return degraded status when some services are unhealthy', async () => {
      // Mock mixed dependency check responses
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('metadata-events') || url.includes('stream-ingestion')) {
          return Promise.resolve({
            data: {
              status: 'ok',
              service: 'test-service',
              timestamp: new Date().toISOString()
            }
          });
        } else if (url.includes('recording') || url.includes('object-detection')) {
          return Promise.resolve({
            data: {
              status: 'error',
              service: 'test-service',
              timestamp: new Date().toISOString()
            }
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'degraded');
    });
  });

  describe('GET /health/liveness', () => {
    it('should return 200 and basic status information', async () => {
      const response = await request(app).get('/health/liveness');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service', 'api-gateway');
      expect(response.body).toHaveProperty('timestamp');
      // Should not include full dependency information
      expect(response.body).not.toHaveProperty('dependencies');
    });
  });

  describe('GET /health/readiness', () => {
    it('should return 200 when critical dependencies are available', async () => {
      // Mock successful dependency checks
      mockedAxios.get.mockImplementation((url) => {
        return Promise.resolve({
          data: {
            status: 'ok',
            service: 'test-service',
            timestamp: new Date().toISOString()
          }
        });
      });

      const response = await request(app).get('/health/readiness');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('dependencies');
    });

    it('should return 503 when critical dependencies are unavailable', async () => {
      // Mock failed dependency checks
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/health/readiness');
      
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'error');
    });
  });
});