export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly metadata?: Record<string, unknown>;

  constructor(message: string, metadata?: Record<string, unknown>, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.metadata = metadata;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = "VALIDATION_FAILED";
}

export class AuthenticationError extends AppError {
  public readonly statusCode = 401;
  public readonly errorCode = "UNAUTHENTICATED";
}

export class ForbiddenError extends AppError {
  public readonly statusCode = 403;
  public readonly errorCode = "INSUFFICIENT_PERMISSIONS";
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly errorCode = "RESOURCE_NOT_FOUND";
}

export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly errorCode = "RESOURCE_CONFLICT";
}

export class RateLimitError extends AppError {
  public readonly statusCode = 429;
  public readonly errorCode = "RATE_LIMITED";
}

export class ConfigurationError extends AppError {
  public readonly statusCode = 500;
  public readonly errorCode = "CONFIGURATION_INVALID";
}

export class ExternalServiceError extends AppError {
  public readonly statusCode = 502;
  public readonly errorCode = "THIRD_PARTY_FAILURE";
}
