import { RouteHandlerBuilder } from './routeHandlerBuilder';
import { HandlerServerErrorFn, HandlerZodErrorFn } from './types';

export function createZodRoute(params?: {
  handleServerError?: HandlerServerErrorFn;
  handleZodError?: HandlerZodErrorFn;
}) {
  return new RouteHandlerBuilder({
    handleServerError: params?.handleServerError,
    handleZodError: params?.handleZodError,
    contextType: {},
  });
}
