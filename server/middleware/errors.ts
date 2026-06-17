export class AppError extends Error {
  status: number;
  errors: string[];

  constructor(message: string, status = 400, errors: string[] = []) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.errors = errors;
  }

  static unauthorized(message = "Authentication required") {
    return new AppError(message, 401);
  }

  static forbidden(message = "Forbidden") {
    return new AppError(message, 403);
  }

  static notFound(message = "Not found") {
    return new AppError(message, 404);
  }

  static validation(message: string, errors: string[] = []) {
    return new AppError(message, 400, errors);
  }
}
