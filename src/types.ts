/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema } from 'zod';

export type HandlerFunction<TParams, TQuery, TBody, TContext, TMetadata> = (
  request: Request,
  context: { params: TParams; query: TQuery; body: TBody; data: TContext; metadata: TMetadata },
) => any;

export type MetadataSchema = Schema | undefined;

export interface RouteHandlerBuilderConfig {
  paramsSchema: Schema;
  querySchema: Schema;
  bodySchema: Schema;
}

export type OriginalRouteHandler = (request: Request, context?: { params: Record<string, unknown> }) => any;

export type HandlerServerErrorFn = (error: Error) => Response;
