import { z } from 'zod';

import { RouteHandlerBuilder } from './routeHandlerBuilder';
import { HandlerServerErrorFn } from './types';

export function createZodRoute<MetadataSchema extends z.Schema | undefined = undefined>(params?: {
  handleServerError?: HandlerServerErrorFn;
  defineMetadataSchema?: () => MetadataSchema;
}) {
  return new RouteHandlerBuilder({
    handleServerError: params?.handleServerError,
    metadataValue: undefined,
    contextType: {},
  });
}
