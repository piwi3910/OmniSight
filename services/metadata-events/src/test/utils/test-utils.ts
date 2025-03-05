/**
 * Common test utilities for the metadata-events service
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Create a mock Express Request object
 */
export function mockRequest(options: {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
  user?: any;
  ip?: string;
  method?: string;
  path?: string;
} = {}): Request {
  const req = {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {},
    user: options.user || null,
    ip: options.ip || '127.0.0.1',
    method: options.method || 'GET',
    path: options.path || '/',
    get: jest.fn((name: string) => {
      return options.headers?.[name];
    }),
  } as unknown as Request;
  
  return req;
}

/**
 * Create a mock Express Response object
 */
export function mockResponse(): Response {
  const res = {} as Response;
  
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.sendStatus = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  res.contentType = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  res.render = jest.fn(() => res);
  res.end = jest.fn(() => res);
  
  return res;
}

/**
 * Reset all mocks in the mock Prisma client
 */
export function resetPrismaMocks(prisma: PrismaClient): void {
  Object.keys(prisma).forEach(key => {
    const value = (prisma as any)[key];
    if (typeof value === 'object' && value !== null) {
      Object.keys(value).forEach(method => {
        if (typeof value[method] === 'function' && typeof value[method].mockReset === 'function') {
          value[method].mockReset();
        }
      });
    }
  });
}

/**
 * Generate a random ID for testing
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Wait for a specified duration (in milliseconds)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Expect a function to throw an error with a specific message
 */
export async function expectToThrow(
  fn: () => Promise<any> | any,
  expectedMessage?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw an error, but it did not');
  } catch (error) {
    if (expectedMessage) {
      if (expectedMessage instanceof RegExp) {
        expect((error as Error).message).toMatch(expectedMessage);
      } else {
        expect((error as Error).message).toContain(expectedMessage);
      }
    }
  }
}

/**
 * Create a test observable that can be subscribed to
 */
export function createTestObservable<T>(values: T[], delay = 0): {
  subscribe: (callback: (value: T) => void) => { unsubscribe: () => void };
} {
  return {
    subscribe: (callback: (value: T) => void) => {
      const timeouts: NodeJS.Timeout[] = [];
      
      values.forEach((value, index) => {
        const timeout = setTimeout(() => {
          callback(value);
        }, delay * index);
        
        timeouts.push(timeout);
      });
      
      return {
        unsubscribe: () => {
          timeouts.forEach(clearTimeout);
        },
      };
    },
  };
}