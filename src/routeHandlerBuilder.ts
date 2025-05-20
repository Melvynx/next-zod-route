// eslint-disable-next-line import/no-named-as-default
import z from 'zod';

import {
  HandlerFunction,
  HandlerServerErrorFn,
  MiddlewareFunction,
  MiddlewareResult,
  NextFunction,
  OriginalRouteHandler,
} from './types';

/**
 * Type of the middleware function passed to a safe action client.
 */
export type MiddlewareFn<TContext, TReturnType, TMetadata = unknown> = {
  (opts: { context: TContext; request: Request; metadata?: TMetadata }): Promise<TReturnType>;
};

export class InternalRouteHandlerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InternalRouteHandlerError';
  }
}

export class RouteHandlerBuilder<
  TParams extends z.Schema = z.Schema,
  TQuery extends z.Schema = z.Schema,
  TBody extends z.Schema = z.Schema,
  // eslint-disable-next-line @typescript-eslint/ban-types
  TContext = {},
  TMetadata extends z.Schema = z.Schema,
  TResponse extends z.Schema = z.Schema,
> {
  readonly config: {
    paramsSchema: TParams;
    querySchema: TQuery;
    bodySchema: TBody;
    metadataSchema?: TMetadata;
  };
  readonly middlewares: Array<MiddlewareFunction<TContext, Record<string, unknown>, z.infer<TMetadata>>>;
  readonly handleServerError?: HandlerServerErrorFn;
  readonly metadataValue: z.infer<TMetadata>;
  readonly contextType!: TContext;

  constructor({
    config = {
      paramsSchema: undefined as unknown as TParams,
      querySchema: undefined as unknown as TQuery,
      bodySchema: undefined as unknown as TBody,
      metadataSchema: undefined as unknown as TMetadata,
      responseSchema: undefined as unknown as TResponse,
    },
    middlewares = [],
    handleServerError,
    contextType,
    metadataValue,
  }: {
    config?: {
      paramsSchema: TParams;
      querySchema: TQuery;
      bodySchema: TBody;
      metadataSchema?: TMetadata;
      responseSchema?: TResponse;
    };
    middlewares?: Array<MiddlewareFunction<TContext, Record<string, unknown>, z.infer<TMetadata>>>;
    handleServerError?: HandlerServerErrorFn;
    contextType: TContext;
    metadataValue?: z.infer<TMetadata>;
    responseSchema?: TResponse;
  }) {
    this.config = config;
    this.middlewares = middlewares;
    this.handleServerError = handleServerError;
    this.contextType = contextType as TContext;
    this.metadataValue = metadataValue;
  }

  /**
   * Define the schema for the params
   * @param schema - The schema for the params
   * @returns A new instance of the RouteHandlerBuilder
   */
  params<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<T, TQuery, TBody, TContext, TMetadata>({
      ...this,
      config: { ...this.config, paramsSchema: schema },
    });
  }

  /**
   * Define the schema for the query
   * @param schema - The schema for the query
   * @returns A new instance of the RouteHandlerBuilder
   */
  query<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<TParams, T, TBody, TContext, TMetadata>({
      ...this,
      config: { ...this.config, querySchema: schema },
    });
  }

  /**
   * Define the schema for the body
   * @param schema - The schema for the body
   * @returns A new instance of the RouteHandlerBuilder
   */
  body<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<TParams, TQuery, T, TContext, TMetadata>({
      ...this,
      config: { ...this.config, bodySchema: schema },
    });
  }

  /**
   * Define the schema for the response
   * @param schema - The schema for the response
   * @returns A new instance of the RouteHandlerBuilder
   */
  response<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<TParams, TQuery, TBody, TContext, TMetadata, T>({
      ...this,
      config: { ...this.config, responseSchema: schema },
    });
  }

  /**
   * Define the schema for the metadata
   * @param schema - The schema for the metadata
   * @returns A new instance of the RouteHandlerBuilder
   */
  defineMetadata<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<TParams, TQuery, TBody, TContext, T>({
      ...this,
      config: { ...this.config, metadataSchema: schema },
    });
  }

  /**
   * Set the metadata value for the route handler
   * @param value - The metadata value that will be passed to middlewares
   * @returns A new instance of the RouteHandlerBuilder
   */
  metadata(value: z.infer<TMetadata>) {
    return new RouteHandlerBuilder<TParams, TQuery, TBody, TContext, TMetadata>({
      ...this,
      metadataValue: value,
    });
  }

  /**
   * Add a middleware to the route handler
   * @param middleware - The middleware function to be executed
   * @returns A new instance of the RouteHandlerBuilder
   */
  use<TNestContext extends Record<string, unknown>>(
    middleware: MiddlewareFunction<TContext, TNestContext & TContext, z.infer<TMetadata>>,
  ): RouteHandlerBuilder<TParams, TQuery, TBody, TContext & TNestContext, TMetadata> {
    type MergedContext = TContext & TNestContext;

    return new RouteHandlerBuilder<TParams, TQuery, TBody, MergedContext, TMetadata>({
      ...this,
      middlewares: [...this.middlewares, middleware],
      contextType: {} as MergedContext,
    });
  }

  /**
   * Create the handler function that will be used by Next.js
   * @param handler - The handler function that will be called when the route is hit
   * @returns The original route handler that Next.js expects with the validation logic
   */
  handler<TReturn = Response>(
    handler: HandlerFunction<z.infer<TParams>, z.infer<TQuery>, z.infer<TBody>, TContext, z.infer<TMetadata>, TReturn>,
  ): OriginalRouteHandler<Promise<Response>> {
    return async (request, context): Promise<Response> => {
      try {
        const url = new URL(request.url);
        let params = context?.params ? await context.params : {};
        let query = Object.fromEntries(url.searchParams.entries());
        let metadata = this.metadataValue;

        // Support both JSON and FormData parsing
        let body: unknown = {};
        if (request.method !== 'GET' && request.method !== 'DELETE') {
          try {
            const contentType = request.headers.get('content-type') || '';
            if (
              contentType.includes('multipart/form-data') ||
              contentType.includes('application/x-www-form-urlencoded')
            ) {
              const formData = await request.formData();
              body = Object.fromEntries(formData.entries());
            } else {
              body = await request.json();
            }
          } catch (error) {
            if (this.config.bodySchema) {
              throw new InternalRouteHandlerError(JSON.stringify({ message: 'Invalid body', errors: error }));
            }
          }
        }

        // Validate the params against the provided schema
        if (this.config.paramsSchema) {
          const paramsResult = this.config.paramsSchema.safeParse(params);
          if (!paramsResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid params', errors: paramsResult.error.issues }),
            );
          }
          params = paramsResult.data;
        }

        // Validate the query against the provided schema
        if (this.config.querySchema) {
          const queryResult = this.config.querySchema.safeParse(query);
          if (!queryResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid query', errors: queryResult.error.issues }),
            );
          }
          query = queryResult.data;
        }

        // Validate the body against the provided schema
        if (this.config.bodySchema) {
          const bodyResult = this.config.bodySchema.safeParse(body);
          if (!bodyResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid body', errors: bodyResult.error.issues }),
            );
          }
          body = bodyResult.data;
        }

        // Validate the metadata against the provided schema
        if (this.config.metadataSchema && metadata !== undefined) {
          const metadataResult = this.config.metadataSchema.safeParse(metadata);
          if (!metadataResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid metadata', errors: metadataResult.error.issues }),
            );
          }
          metadata = metadataResult.data;
        }

        // Execute middleware chain
        let middlewareContext: TContext = {} as TContext;

        const executeMiddlewareChain = async (index: number): Promise<Response> => {
          if (index >= this.middlewares.length) {
            try {
              const result = await handler(request, {
                params: params as z.infer<TParams>,
                query: query as z.infer<TQuery>,
                body: body as z.infer<TBody>,
                ctx: middlewareContext,
                metadata: metadata as z.infer<TMetadata>,
              });

              if (result instanceof Response) return result;

              return new Response(JSON.stringify(result), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              });
            } catch (error) {
              return handleError(error as Error, this.handleServerError);
            }
          }

          const middleware = this.middlewares[index];
          if (!middleware) return executeMiddlewareChain(index + 1);

          const next: NextFunction<TContext> = async (options = {}) => {
            if (options.ctx) {
              middlewareContext = { ...middlewareContext, ...options.ctx };
            }
            const result = await executeMiddlewareChain(index + 1);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return result as MiddlewareResult<any>;
          };

          try {
            const result = await middleware({
              request,
              ctx: middlewareContext,
              metadata,
              next,
            });

            if (result instanceof Response) return result;

            middlewareContext = { ...middlewareContext };
            return result;
          } catch (error) {
            return handleError(error as Error, this.handleServerError);
          }
        };

        return executeMiddlewareChain(0);
      } catch (error) {
        return handleError(error as Error, this.handleServerError);
      }
    };
  }
}

const handleError = (error: Error, handleServerError?: HandlerServerErrorFn): Response => {
  if (error instanceof InternalRouteHandlerError) {
    return new Response(error.message, { status: 400 });
  }

  if (handleServerError) {
    return handleServerError(error as Error);
  }

  return new Response(JSON.stringify({ message: 'Internal server error' }), { status: 500 });
};
