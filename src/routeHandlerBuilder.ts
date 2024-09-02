// eslint-disable-next-line import/no-named-as-default
import z from 'zod';

import { HandlerFunction, HandlerServerErrorFn, OriginalRouteHandler } from './types';

type Middleware<
  TContext = Record<string, unknown>,
  TMetadata = unknown,
  TReturnType = Record<string, unknown>,
> = (opts: { request: Request; metadata?: TMetadata; context?: TContext }) => Promise<TReturnType>;

/**
 * Type of the middleware function passed to a safe action client.
 */
export type MiddlewareFn<TMetadata, TContext, TReturnType> = {
  (opts: { context: TContext; metadata: TMetadata; request: Request }): Promise<TReturnType>;
};

class InternalRouteHandlerError extends Error {}

export class RouteHandlerBuilder<
  TParams extends z.Schema = z.Schema,
  TQuery extends z.Schema = z.Schema,
  TMetadataSchema extends z.Schema | undefined = undefined,
  TMetadata = TMetadataSchema extends z.Schema ? z.infer<z.Schema> : undefined,
  TBody extends z.Schema = z.Schema,
  TContext = Record<string, unknown>,
> {
  readonly config: {
    paramsSchema: TParams;
    querySchema: TQuery;
    bodySchema: TBody;
  };
  readonly middlewares: Middleware<TContext, TMetadata>[];
  readonly handleServerError?: HandlerServerErrorFn;
  readonly metadataSchema: TMetadataSchema;
  readonly metadataValue: TMetadata;
  readonly contextType: TContext;

  constructor({
    config = {
      paramsSchema: undefined as unknown as TParams,
      querySchema: undefined as unknown as TQuery,
      bodySchema: undefined as unknown as TBody,
    },
    middlewares = [],
    handleServerError,
    metadataSchema,
    metadataValue,
    contextType,
  }: {
    config?: {
      paramsSchema: TParams;
      querySchema: TQuery;
      bodySchema: TBody;
    };
    middlewares?: Middleware<TContext, TMetadata>[];
    handleServerError?: HandlerServerErrorFn;
    metadataSchema: TMetadataSchema;
    metadataValue: TMetadata;
    contextType: TContext;
  }) {
    this.config = config;
    this.middlewares = middlewares;
    this.handleServerError = handleServerError;
    this.metadataSchema = metadataSchema;
    this.metadataValue = metadataValue;
    this.contextType = contextType;
  }

  /**
   * Define the schema for the params
   * @param schema - The schema for the params
   * @returns A new instance of the RouteHandlerBuilder
   */
  params<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder({
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
    return new RouteHandlerBuilder({
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
    return new RouteHandlerBuilder({
      ...this,
      config: { ...this.config, bodySchema: schema },
    });
  }

  /**
   * Add metadata if the defineMetadataSchema is provided
   * @param data - The value that matches the metadata schema
   * @returns A new instance of the RouteHandlerBuilder
   */
  metadata(data: TMetadataSchema extends z.Schema ? z.infer<z.Schema> : undefined) {
    if (!this.metadataSchema) {
      throw new Error('Metadata schema is not defined');
    }

    return new RouteHandlerBuilder({
      ...this,
      metadataValue: data,
    });
  }

  /**
   * Add a middleware to the route handler
   * @param middleware - The middleware function to be executed
   * @returns A new instance of the RouteHandlerBuilder
   */
  use<TReturnType extends Record<string, unknown>>(middleware: MiddlewareFn<TMetadata, TContext, TReturnType>) {
    return new RouteHandlerBuilder({
      ...this,
      middlewares: [...this.middlewares, middleware],
      contextType: {} as unknown extends TContext ? TReturnType : TContext & TReturnType,
    });
  }

  /**
   * Create the handler function that will be used by Next.js
   * @param handler - The handler function that will be called when the route is hit
   * @returns The original route handler that Next.js expects with the validation logic
   */
  handler(
    handler: HandlerFunction<z.infer<TParams>, z.infer<TQuery>, z.infer<TBody>, TContext, TMetadata>,
  ): OriginalRouteHandler {
    return async (request, context): Promise<Response> => {
      try {
        const url = new URL(request.url);
        const params = context?.params || {};
        const query = Object.fromEntries(url.searchParams.entries());
        const body = request.method !== 'GET' ? await request.json() : {};

        // Validate the params against the provided schema
        if (this.config.paramsSchema) {
          const paramsResult = this.config.paramsSchema.safeParse(params);
          if (!paramsResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid params', errors: paramsResult.error.issues }),
            );
          }
        }

        // Validate the query against the provided schema
        if (this.config.querySchema) {
          const queryResult = this.config.querySchema.safeParse(query);
          if (!queryResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid query', errors: queryResult.error.issues }),
            );
          }
        }

        // Validate the body against the provided schema
        if (this.config.bodySchema) {
          const bodyResult = this.config.bodySchema.safeParse(body);
          if (!bodyResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid body', errors: bodyResult.error.issues }),
            );
          }
        }

        // Validate the metadata against the provided schema
        if (this.metadataSchema) {
          const metadataResult = this.metadataSchema.safeParse(this.metadataValue);
          if (!metadataResult.success) {
            console.error("Error: You define a metadata schema but didn't provide a metadata value.");
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid metadata (Server Side)', errors: metadataResult.error.issues }),
            );
          }
        }

        // Execute middlewares and build context
        let middlewareContext: TContext = {} as TContext;
        for (const middleware of this.middlewares) {
          const result = await middleware({
            request,
            metadata: this.metadataValue,
            context: middlewareContext,
          });
          middlewareContext = { ...middlewareContext, ...result };
        }

        // Call the handler function with the validated params, query, and body
        const result = await handler(request, {
          params: params as z.infer<TParams>,
          query: query as z.infer<TQuery>,
          body: body as z.infer<TBody>,
          data: middlewareContext,
          metadata: this.metadataValue,
        });
        return result;
      } catch (error) {
        if (error instanceof InternalRouteHandlerError) {
          return new Response(error.message, { status: 400 });
        }

        if (this.handleServerError) {
          return this.handleServerError(error as Error);
        }

        return new Response(JSON.stringify({ message: 'Internal server error' }), { status: 500 });
      }
    };
  }
}
