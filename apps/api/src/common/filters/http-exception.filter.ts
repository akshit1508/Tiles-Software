import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const isMulterError =
      exception &&
      typeof exception === 'object' &&
      (exception as Record<string, unknown>).name === 'MulterError';

    let status = isHttpException
      ? exception.getStatus()
      : isMulterError
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = isHttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let errors: any = null;

    if (isMulterError) {
      const multerCode = (exception as Record<string, unknown>).code;
      if (multerCode === 'LIMIT_FILE_SIZE') {
        message = 'File size exceeds 5MB limit';
      } else if (multerCode === 'LIMIT_FILE_COUNT' || multerCode === 'LIMIT_UNEXPECTED_FILE') {
        message = 'Maximum 5 images allowed per upload request';
      } else {
        message = (exception as Error).message || 'File upload error';
      }
    } else if (typeof errorResponse === 'string') {
      message = errorResponse;
    } else if (errorResponse && typeof errorResponse === 'object') {
      const respObj = errorResponse as Record<string, any>;
      message = respObj.message || message;
      errors = respObj.errors || null;
    } else if (exception instanceof Error && process.env.NODE_ENV !== 'production') {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status} - ${
          exception instanceof Error ? exception.stack : JSON.stringify(exception)
        }`,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(errors ? { errors } : {}),
    });
  }
}
