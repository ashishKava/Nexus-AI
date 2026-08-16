export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(404, "Not Found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(409, "Conflict", message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request") {
    super(400, "Bad Request", message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", public readonly details?: any) {
    super(400, "Validation Error", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized access") {
    super(401, "Unauthorized", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access forbidden") {
    super(403, "Forbidden", message);
  }
}
