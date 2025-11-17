// eslint-disable-next-line import/no-named-as-default
import z from 'zod/v4';

import {
  HandlerFunction,
  HandlerServerErrorFn,
  HandlerZodErrorFn,
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
  zodError?: z.ZodError;
  field?: 'params' | 'query' | 'body' | 'headers' | 'metadata' | 'response';

  constructor(
    message: string,
    zodError?: z.ZodError,
    field?: 'params' | 'query' | 'body' | 'headers' | 'metadata' | 'response',
  ) {
    super(message);
    this.name = 'InternalRouteHandlerError';
    this.zodError = zodError;
    this.field = field;
  }
}

export class RouteHandlerBuilder<
  TParams extends z.Schema = z.Schema,
  TQuery extends z.Schema = z.Schema,
  TBody extends z.Schema = z.Schema,
  THeaders extends z.Schema = z.Schema,
  // eslint-disable-next-line @typescript-eslint/ban-types
  TContext = {},
  TMetadata extends z.Schema = z.Schema,
  TResponseSchemas extends Record<number, z.Schema> = Record<number, z.Schema>,
> {
  readonly config: {
    paramsSchema: TParams;
    querySchema: TQuery;
    bodySchema: TBody;
    headersSchema?: THeaders;
    metadataSchema?: TMetadata;
    responseSchemas: TResponseSchemas;
  };
  readonly middlewares: Array<MiddlewareFunction<TContext, Record<string, unknown>, z.infer<TMetadata>>>;
  readonly handleServerError?: HandlerServerErrorFn;
  readonly handleZodError?: HandlerZodErrorFn;
  readonly metadataValue?: z.infer<TMetadata>;
  readonly contextType!: TContext;
  readonly strict: boolean;

  constructor({
    config = {
      paramsSchema: undefined as unknown as TParams,
      querySchema: undefined as unknown as TQuery,
      bodySchema: undefined as unknown as TBody,
      headersSchema: undefined as unknown as THeaders,
      metadataSchema: undefined as unknown as TMetadata,
      responseSchemas: {} as TResponseSchemas,
    },
    middlewares = [],
    handleServerError,
    handleZodError,
    contextType,
    metadataValue,
    strict = false,
  }: {
    config?: {
      paramsSchema: TParams;
      querySchema: TQuery;
      bodySchema: TBody;
      headersSchema?: THeaders;
      metadataSchema?: TMetadata;
      responseSchemas?: TResponseSchemas;
    };
    middlewares?: Array<MiddlewareFunction<TContext, Record<string, unknown>, z.infer<TMetadata>>>;
    handleServerError?: HandlerServerErrorFn;
    handleZodError?: HandlerZodErrorFn;
    contextType: TContext;
    metadataValue?: z.infer<TMetadata>;
    strict?: boolean;
  }) {
    this.config = {
      ...config,
      responseSchemas: config.responseSchemas ?? ({} as TResponseSchemas),
    };
    this.middlewares = middlewares;
    this.handleServerError = handleServerError;
    this.handleZodError = handleZodError;
    this.contextType = contextType as TContext;
    this.metadataValue = metadataValue;
    this.strict = strict;
  }

  /**
   * Define the schema for the params
   * @param schema - The schema for the params
   * @returns A new instance of the RouteHandlerBuilder
   */
  params<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<T, TQuery, TBody, THeaders, TContext, TMetadata, TResponseSchemas>({
      ...this,
      config: { ...this.config, paramsSchema: schema },
      strict: this.strict,
    });
  }

  /**
   * Define the schema for the query
   * @param schema - The schema for the query
   * @returns A new instance of the RouteHandlerBuilder
   */
  query<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<TParams, T, TBody, THeaders, TContext, TMetadata, TResponseSchemas>({
      ...this,
      config: { ...this.config, querySchema: schema },
      strict: this.strict,
    });
  }

  /**
   * Define the schema for the body
   * @param schema - The schema for the body
   * @returns A new instance of the RouteHandlerBuilder
   */
  body<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<TParams, TQuery, T, THeaders, TContext, TMetadata, TResponseSchemas>({
      ...this,
      config: { ...this.config, bodySchema: schema },
      strict: this.strict,
    });
  }

  /**
   * Define the schema for the headers
   * @param schema - The schema for the headers
   * @returns A new instance of the RouteHandlerBuilder
   */
  headers<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<TParams, TQuery, TBody, T, TContext, TMetadata, TResponseSchemas>({
      ...this,
      config: { ...this.config, headersSchema: schema },
    });
  }

  /**
   * Define the schema for the metadata
   * @param schema - The schema for the metadata
   * @returns A new instance of the RouteHandlerBuilder
   */
  defineMetadata<T extends z.Schema>(schema: T) {
    return new RouteHandlerBuilder<TParams, TQuery, TBody, THeaders, TContext, T, TResponseSchemas>({
      config: { ...this.config, metadataSchema: schema },
      middlewares: [],
      handleServerError: this.handleServerError,
      handleZodError: this.handleZodError,
      contextType: this.contextType,
      metadataValue: undefined,
      strict: this.strict,
    });
  }

  /**
   * Set the metadata value for the route handler
   * @param value - The metadata value that will be passed to middlewares
   * @returns A new instance of the RouteHandlerBuilder
   */
  metadata(value: z.infer<TMetadata>) {
    return new RouteHandlerBuilder<TParams, TQuery, TBody, THeaders, TContext, TMetadata, TResponseSchemas>({
      ...this,
      metadataValue: value,
      strict: this.strict,
    });
  }

  /**
   * Add a middleware to the route handler
   * @param middleware - The middleware function to be executed
   * @returns A new instance of the RouteHandlerBuilder
   */
  use<TNestContext extends Record<string, unknown>>(
    middleware: MiddlewareFunction<TContext, TNestContext & TContext, z.infer<TMetadata>>,
  ): RouteHandlerBuilder<TParams, TQuery, TBody, THeaders, TContext & TNestContext, TMetadata, TResponseSchemas> {
    type MergedContext = TContext & TNestContext;

    return new RouteHandlerBuilder<TParams, TQuery, TBody, THeaders, MergedContext, TMetadata, TResponseSchemas>({
      ...this,
      middlewares: [...this.middlewares, middleware],
      contextType: {} as MergedContext,
      strict: this.strict,
    });
  }

  /**
   * Define the schema for the response at a specific HTTP status code
   * @param statusCode - The HTTP status code to validate responses for
   * @param schema - The Zod schema to validate the response body against
   * @returns A new instance of the RouteHandlerBuilder
   * @throws Error if the status code has already been registered
   */
  response<TStatusCode extends number, TSchema extends z.Schema>(
    statusCode: TStatusCode,
    schema: TSchema,
  ): RouteHandlerBuilder<
    TParams,
    TQuery,
    TBody,
    THeaders,
    TContext,
    TMetadata,
    TResponseSchemas & { [K in TStatusCode]: TSchema }
  > {
    // Runtime check for duplicate status codes
    if (this.config.responseSchemas && statusCode in this.config.responseSchemas) {
      throw new Error(`Response schema for status code ${statusCode} has already been registered`);
    }

    return new RouteHandlerBuilder<
      TParams,
      TQuery,
      TBody,
      THeaders,
      TContext,
      TMetadata,
      TResponseSchemas & { [K in TStatusCode]: TSchema }
    >({
      ...this,
      config: {
        ...this.config,
        responseSchemas: {
          ...this.config.responseSchemas,
          [statusCode]: schema,
        } as TResponseSchemas & { [K in TStatusCode]: TSchema },
      },
      strict: this.strict,
    });
  }

  /**
   * Create the handler function that will be used by Next.js
   * @param handler - The handler function that will be called when the route is hit
   * @returns The original route handler that Next.js expects with the validation logic
   */
  handler(
    handler: HandlerFunction<
      z.infer<TParams>,
      z.infer<TQuery>,
      z.infer<TBody>,
      THeaders extends z.Schema ? z.infer<THeaders> : Record<string, string>,
      TContext,
      z.infer<TMetadata>
    >,
  ): OriginalRouteHandler {
    return async (request, context): Promise<Response> => {
      try {
        const url = new URL(request.url);
        let params = context?.params ? await context.params : {};
        let query = Object.fromEntries(
          [...url.searchParams.keys()].map((key) => {
            const values = url.searchParams.getAll(key);
            return values.length === 1 ? [key, values[0]] : [key, values];
          }),
        );
        let metadata = this.metadataValue;

        // Extract headers from request and normalize to lowercase keys
        const headersMap: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headersMap[key.toLowerCase()] = value;
        });
        let headers: Record<string, string> = headersMap;

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
          const schema = this.config.paramsSchema as unknown as z.ZodObject;
          const schemaToUse = this.strict ? schema.strip() : schema;
          const paramsResult = schemaToUse.safeParse(params);
          if (!paramsResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid params', errors: paramsResult.error.issues }),
              paramsResult.error,
              'params',
            );
          }
          params = paramsResult.data as Record<string, unknown>;
        } else if (this.strict && Object.keys(params).length > 0) {
          // In strict mode, ignore params if no schema is defined
          params = {};
        }

        // Validate the query against the provided schema
        if (this.config.querySchema) {
          const schema = this.config.querySchema as unknown as z.ZodObject;
          const schemaToUse = this.strict ? schema.strip() : schema;
          const queryResult = schemaToUse.safeParse(query);
          if (!queryResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid query', errors: queryResult.error.issues }),
              queryResult.error,
              'query',
            );
          }
          query = queryResult.data;
        } else if (this.strict && Object.keys(query).length > 0) {
          // In strict mode, ignore query if no schema is defined
          query = {};
        }

        // Validate the body against the provided schema
        if (this.config.bodySchema) {
          const schema = this.config.bodySchema as unknown as z.ZodObject;
          const schemaToUse = this.strict ? schema.strip() : schema;
          const bodyResult = schemaToUse.safeParse(body);
          if (!bodyResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid body', errors: bodyResult.error.issues }),
              bodyResult.error,
              'body',
            );
          }
          body = bodyResult.data;
        } else if (
          this.strict &&
          body &&
          typeof body === 'object' &&
          body !== null &&
          Object.keys(body as Record<string, unknown>).length > 0
        ) {
          // In strict mode, ignore body if no schema is defined
          body = {};
        }

        // Validate the headers against the provided schema
        if (this.config.headersSchema) {
          const headersResult = this.config.headersSchema.safeParse(headers);
          if (!headersResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid headers', errors: headersResult.error.issues }),
              headersResult.error,
              'headers',
            );
          }
          headers = headersResult.data as Record<string, string>;
        }

        // Validate the metadata against the provided schema
        if (this.config.metadataSchema && metadata !== undefined) {
          const schema = this.config.metadataSchema as unknown as z.ZodObject;
          const schemaToUse = this.strict ? schema.strip() : schema;
          const metadataResult = schemaToUse.safeParse(metadata);
          if (!metadataResult.success) {
            throw new InternalRouteHandlerError(
              JSON.stringify({ message: 'Invalid metadata', errors: metadataResult.error.issues }),
              metadataResult.error,
              'metadata',
            );
          }
          metadata = metadataResult.data as z.infer<TMetadata>;
        }

        // Execute middleware chain
        let middlewareContext: TContext = {} as TContext;

        const validateResponse = async (response: Response): Promise<Response> => {
          const statusCode = response.status;
          const schema = this.config.responseSchemas[statusCode];

          // Clone the response so we can read the body without consuming it
          const clonedResponse = response.clone();

          // Try to parse the response body as JSON
          const contentType = response.headers.get('content-type') || '';
          const isJson = contentType.includes('application/json');

          // In strict mode, require a schema for JSON responses
          if (this.strict && isJson && !schema) {
            throw new InternalRouteHandlerError(
              JSON.stringify({
                message: `Invalid response: response validator required for status code ${statusCode} in strict mode`,
                errors: [],
              }),
            );
          }

          // If no schema is registered for this status code, skip validation
          if (!schema) {
            return response;
          }

          // If response is not JSON, skip validation (even in strict mode)
          if (!isJson) {
            return response;
          }

          try {
            const bodyText = await clonedResponse.text();
            let bodyData: unknown;

            try {
              bodyData = bodyText ? JSON.parse(bodyText) : null;
            } catch (parseError) {
              // If JSON parsing fails, throw validation error
              throw new InternalRouteHandlerError(
                JSON.stringify({
                  message: 'Invalid response: response body is not valid JSON',
                  errors: parseError,
                }),
              );
            }

            // Validate the parsed body against the schema
            const schemaToValidate = schema as unknown as z.ZodObject;
            const schemaToUse = this.strict ? schemaToValidate.strip() : schemaToValidate;
            const validationResult = schemaToUse.safeParse(bodyData);
            if (!validationResult.success) {
              throw new InternalRouteHandlerError(
                JSON.stringify({
                  message: `Invalid response: response body does not match schema for status ${statusCode}`,
                  errors: validationResult.error.issues,
                }),
                validationResult.error,
                'response',
              );
            }

            // Validation passed, return the original response
            return response;
          } catch (error) {
            // Re-throw InternalRouteHandlerError, wrap other errors
            if (error instanceof InternalRouteHandlerError) {
              throw error;
            }
            throw new InternalRouteHandlerError(
              JSON.stringify({
                message: 'Invalid response: error validating response body',
                errors: error,
              }),
            );
          }
        };

        const executeMiddlewareChain = async (index: number): Promise<Response> => {
          if (index >= this.middlewares.length) {
            try {
              const result = await handler(request, {
                params: params as z.infer<TParams>,
                query: query as z.infer<TQuery>,
                body: body as z.infer<TBody>,
                headers: headers as THeaders extends z.Schema ? z.infer<THeaders> : Record<string, string>,
                ctx: middlewareContext,
                metadata: metadata as z.infer<TMetadata>,
              });

              let response: Response;
              if (result instanceof Response) {
                response = result;
              } else {
                response = new Response(JSON.stringify(result), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                });
              }

              // Validate the response against registered schemas
              return await validateResponse(response);
            } catch (error) {
              return handleError(error as Error, this.handleServerError, this.handleZodError);
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

            if (result instanceof Response) {
              // Validate middleware responses as well
              return await validateResponse(result);
            }

            middlewareContext = { ...middlewareContext };
            return result;
          } catch (error) {
            return handleError(error as Error, this.handleServerError, this.handleZodError);
          }
        };

        return executeMiddlewareChain(0);
      } catch (error) {
        return handleError(error as Error, this.handleServerError, this.handleZodError);
      }
    };
  }
}

const handleError = (
  error: Error,
  handleServerError?: HandlerServerErrorFn,
  handleZodError?: HandlerZodErrorFn,
): Response => {
  if (error instanceof InternalRouteHandlerError) {
    // Handle Zod validation errors (params, query, body, headers, metadata, response)
    if (handleZodError && error.zodError && error.field) {
      return handleZodError(error.field, error.zodError);
    }

    // Default behavior when handleZodError is not provided or ZodError is not available
    // Response validation errors default to 500, others default to 400
    try {
      const errorData = JSON.parse(error.message);
      if (errorData?.message?.includes('Invalid response')) {
        return new Response(error.message, { status: 500 });
      }
    } catch {
      // If parsing fails, treat as regular validation error
    }

    // Regular validation errors (params, query, body, headers, metadata) return 400
    return new Response(error.message, { status: 400 });
  }

  if (handleServerError) {
    return handleServerError(error as Error);
  }

  return new Response(JSON.stringify({ message: 'Internal server error' }), { status: 500 });
};
