import { RouteHandlerBuilder } from './routeHandlerBuilder';
import { HandlerServerErrorFn } from './types';

export function createZodRoute(params?: { handleServerError?: HandlerServerErrorFn }): RouteHandlerBuilder {
  return new RouteHandlerBuilder({
    handleServerError: params?.handleServerError,
  });
}
