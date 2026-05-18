import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : exception instanceof Error
          ? exception.message
          : 'Unexpected server error';

    response.status(status).json({
      success: false,
      message,
      errorCode: exception instanceof Error ? exception.constructor.name : 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}
