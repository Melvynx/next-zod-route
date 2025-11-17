import { RouteHandlerBuilder } from './routeHandlerBuilder';
import type { HandlerServerErrorFn, HandlerZodErrorFn } from './types';

export function createZodRoute(params?: {
  handleServerError?: HandlerServerErrorFn;
  handleZodError?: HandlerZodErrorFn;
  strict?: boolean;
}) {
  return new RouteHandlerBuilder({
    handleServerError: params?.handleServerError,
    handleZodError: params?.handleZodError,
    strict: params?.strict ?? false,
    contextType: {},
  });
}
