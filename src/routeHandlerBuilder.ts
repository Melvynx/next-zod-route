import z from 'zod';

import { HandlerFunction, HandlerServerErrorFn, OriginalRouteHandler, RouteHandlerBuilderConfig } from './types';

type Middleware<T = Record<string, unknown>> = (request: Request) => Promise<T>;

interface RouteHandlerBuilderConstructorParams {
  config?: RouteHandlerBuilderConfig;
  middlewares?: Middleware[];
  handleServerError?: HandlerServerErrorFn;
}

export class RouteHandlerBuilder<
  TParams extends z.Schema = z.Schema,
  TQuery extends z.Schema = z.Schema,
  TBody extends z.Schema = z.Schema,
  TContext extends Record<string, unknown> = Record<string, unknown>,
> {
  private config: RouteHandlerBuilderConfig;
  private middlewares: Middleware[];
  private handleServerError?: HandlerServerErrorFn;

  constructor({
    config = {
      paramsSchema: undefined as unknown as TParams,
      querySchema: undefined as unknown as TQuery,
      bodySchema: undefined as unknown as TBody,
    },
    middlewares = [],
    handleServerError,
  }: RouteHandlerBuilderConstructorParams = {}) {
    this.config = config;
    this.middlewares = middlewares;
    this.handleServerError = handleServerError;
  }

  /**
   * Define the schema for the params
   * @param schema - The schema for the params
   * @returns A new instance of the RouteHandlerBuilder
   */
  params<T extends z.Schema>(schema: T): RouteHandlerBuilder<T, TQuery, TBody> {
    return new RouteHandlerBuilder<T, TQuery, TBody, TContext>({
      ...this,
      config: { ...this.config, paramsSchema: schema },
    });
  }

  /**
   * Define the schema for the query
   * @param schema - The schema for the query
   * @returns A new instance of the RouteHandlerBuilder
   */
  query<T extends z.Schema>(schema: T): RouteHandlerBuilder<TParams, T, TBody> {
    return new RouteHandlerBuilder<TParams, T, TBody, TContext>({
      ...this,
      config: { ...this.config, querySchema: schema },
    });
  }

  /**
   * Define the schema for the body
   * @param schema - The schema for the body
   * @returns A new instance of the RouteHandlerBuilder
   */
  body<T extends z.Schema>(schema: T): RouteHandlerBuilder<TParams, TQuery, T> {
    return new RouteHandlerBuilder<TParams, TQuery, T, TContext>({
      ...this,
      config: { ...this.config, bodySchema: schema },
    });
  }

  /**
   * Add a middleware to the route handler
   * @param middleware - The middleware function to be executed
   * @returns A new instance of the RouteHandlerBuilder
   */
  use<T extends Record<string, unknown>>(
    middleware: Middleware<T>,
  ): RouteHandlerBuilder<TParams, TQuery, TBody, TContext & T> {
    return new RouteHandlerBuilder<TParams, TQuery, TBody, TContext & T>({
      ...this,
      middlewares: [...this.middlewares, middleware],
    });
  }

  /**
   * Create the handler function that will be used by Next.js
   * @param handler - The handler function that will be called when the route is hit
   * @returns The original route handler that Next.js expects with the validation logic
   */
  handler(handler: HandlerFunction<z.infer<TParams>, z.infer<TQuery>, z.infer<TBody>, TContext>): OriginalRouteHandler {
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
            throw new Error(JSON.stringify({ message: 'Invalid params', errors: paramsResult.error.issues }));
          }
        }

        // Validate the query against the provided schema
        if (this.config.querySchema) {
          const queryResult = this.config.querySchema.safeParse(query);
          if (!queryResult.success) {
            throw new Error(JSON.stringify({ message: 'Invalid query', errors: queryResult.error.issues }));
          }
        }

        // Validate the body against the provided schema
        if (this.config.bodySchema) {
          const bodyResult = this.config.bodySchema.safeParse(body);
          if (!bodyResult.success) {
            throw new Error(JSON.stringify({ message: 'Invalid body', errors: bodyResult.error.issues }));
          }
        }

        // Execute middlewares and build context
        let middlewareContext: TContext = {} as TContext;
        for (const middleware of this.middlewares) {
          const result = await middleware(request);
          middlewareContext = { ...middlewareContext, ...result };
        }

        // Call the handler function with the validated params, query, and body
        const result = await handler(request, {
          params: params as z.infer<TParams>,
          query: query as z.infer<TQuery>,
          body: body as z.infer<TBody>,
          data: middlewareContext,
        });
        return result;
      } catch (error) {
        if (this.handleServerError) {
          return this.handleServerError(error as Error);
        }

        if (error instanceof Error) {
          return new Response(error.message, { status: 400 });
        }

        return new Response(JSON.stringify({ message: 'Internal server error' }), { status: 500 });
      }
    };
  }
}
