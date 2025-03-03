import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Error response interface
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    traceId?: string;
    details?: Record<string, any>;
  }
}

// Standard API error codes
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  BAD_GATEWAY = 'BAD_GATEWAY'
}

// Base error class
export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

export class ResourceNotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    super(ErrorCode.RESOURCE_NOT_FOUND, message, 404, { resourceType: resource, resourceId: id });
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(ErrorCode.CONFLICT, message, 409, details);
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(service: string, details?: Record<string, any>) {
    super(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} service is temporarily unavailable`,
      503,
      details
    );
  }
}

// Error logging function type
export type ErrorLogFunction = (error: Error, traceId: string, req: Request) => void;

// Create error handling middleware
export function createErrorHandler(logger: any): (err: Error, req: Request, res: Response, next: NextFunction) => void {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Generate a unique trace ID for this error
    const traceId = uuidv4();
    
    // Extract status code and error code from ApiError, or default values
    const statusCode = err instanceof ApiError ? err.statusCode : 500;
    const errorCode = err instanceof ApiError ? err.code : ErrorCode.INTERNAL_ERROR;
    const details = err instanceof ApiError ? err.details : undefined;
    
    // Prepare error message, sanitizing for non-ApiErrors in production
    const isDev = process.env.NODE_ENV === 'development';
    const message = 
      err instanceof ApiError || isDev 
        ? err.message 
        : 'An unexpected error occurred';

    // Log the error with trace ID for correlation
    logger.error(`[${traceId}] ${err.message}`, {
      traceId,
      path: req.path,
      method: req.method,
      errorCode,
      statusCode,
      stack: isDev ? err.stack : undefined
    });

    // Send the error response
    const errorResponse: ErrorResponse = {
      error: {
        code: errorCode,
        message: message,
        traceId: traceId
      }
    };

    // Add details if available
    if (details) {
      errorResponse.error.details = details;
    }

    res.status(statusCode).json(errorResponse);
  };
}

// Middleware for handling 404 errors for routes that don't exist
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: ErrorResponse = {
    error: {
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`
    }
  };
  
  res.status(404).json(errorResponse);
}

// Helper to create validation error from object
export function createValidationError(errors: Record<string, string>): ValidationError {
  return new ValidationError('Validation failed', errors);
}