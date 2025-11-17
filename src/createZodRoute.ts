import { RouteHandlerBuilder } from './routeHandlerBuilder';
import { HandlerServerErrorFn } from './types';

export function createZodRoute(params?: { handleServerError?: HandlerServerErrorFn; strict?: boolean }) {
  return new RouteHandlerBuilder({
    handleServerError: params?.handleServerError,
    strict: params?.strict ?? false,
    contextType: {},
  });
}
