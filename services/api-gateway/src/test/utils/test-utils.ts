/**
 * Common test utilities for the API Gateway service
 */

import { Request, Response } from 'express';

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