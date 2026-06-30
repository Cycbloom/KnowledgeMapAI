/**
 * Shared error base class and types.
 *
 * Both backend (api/) and frontend (src/) AppError classes inherit from
 * AppErrorBase, ensuring a common serialization contract while keeping
 * platform-specific features.
 */

/** Generic context bag attached to errors. */
export type ErrorContext = { [key: string]: unknown };

/** Contract for the object returned by `AppErrorBase.toJSON()`. */
export interface ErrorSerialization {
  code: string;
  message: string;
  statusCode: number;
  context?: ErrorContext;
  timestamp: string;
}

/**
 * Abstract base class for application errors.
 *
 * Provides the shared shape (code, statusCode, context, timestamp,
 * isOperational) and requires subclasses to implement `toJSON()`.
 */
export abstract class AppErrorBase extends Error {
  abstract toJSON(): ErrorSerialization;

  readonly code: string;
  readonly statusCode: number;
  readonly context?: ErrorContext;
  readonly timestamp: Date;
  readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    context?: ErrorContext,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();
    this.isOperational = isOperational;
  }
}
