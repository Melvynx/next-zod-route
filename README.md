<h1 align="center">next-zod-route</h1>

A fork from [next-safe-route](https://github.com/richardsolomou/next-safe-route) that uses [zod](https://github.com/colinhacks/zod) for schema validation.

<p align="center">
  <a href="https://www.npmjs.com/package/next-zod-route"><img src="https://img.shields.io/npm/v/next-zod-route?style=for-the-badge&logo=npm" /></a>
  <a href="https://github.com/melvynxdev/next-zod-route/actions/workflows/test.yaml"><img src="https://img.shields.io/github/actions/workflow/status/melvynxdev/next-zod-route/test.yaml?style=for-the-badge&logo=vitest" /></a>
  <a href="https://github.com/melvynxdev/next-zod-route/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/next-zod-route?style=for-the-badge" /></a>
</p>

`next-zod-route` is a utility library for Next.js that provides type-safety and schema validation for [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)/API Routes.

## Features

- **✅ Schema Validation:** Automatically validates request parameters, query strings, and body content with built-in error handling.
- **📤 Response Validation:** Validate response bodies against Zod schemas based on HTTP status codes to ensure API contract compliance.
- **🔒 Strict Mode:** Optional strict mode that strips unknown properties from both requests and responses, ensures API contract compliance, and prevents data leakage.
- **🧷 Type-Safe:** Works with full TypeScript type safety for parameters, query strings, and body content.
- **😌 Easy to Use:** Simple and intuitive API that makes defining route handlers a breeze.
- **🔄 Flexible Response Handling:** Return Response objects directly or return plain objects that are automatically converted to JSON responses.
- **🧪 Fully Tested:** Extensive test suite to ensure everything works reliably.
- **🔐 Enhanced Middleware System:** Powerful middleware system with pre/post handler execution, response modification, and context chaining.
- **🎯 Metadata Support:** Add and validate metadata for your routes with full type safety.
- **🛡️ Custom Error Handling:** Flexible error handling with custom error handlers for both middleware and route handlers, plus customizable Zod validation error responses.

## Installation

```sh
npm install next-zod-route zod
```

Or using your preferred package manager:

```sh
pnpm add next-zod-route zod
```

```sh
yarn add next-zod-route zod
```

## Usage

```ts
// app/api/hello/route.ts
import { createZodRoute } from 'next-zod-route';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string(),
});

const querySchema = z.object({
  search: z.string().optional(),
});

const bodySchema = z.object({
  field: z.string(),
});

export const GET = createZodRoute()
  .params(paramsSchema)
  .query(querySchema)
  .handler((request, context) => {
    const { id } = context.params;
    const { search } = context.query;

    return { id, search, permission, role };
  });

export const POST = createZodRoute()
  .params(paramsSchema)
  .query(querySchema)
  .body(bodySchema)
  .handler((request, context) => {
    // Next.js 15 use promise, but with .params we already unwrap the promise for you
    const { id } = context.params;
    const { search } = context.query;
    const { field } = context.body;

    // Custom status
    return NextResponse.json({ id, search, field }), { status: 400 };
  });
```

To define a route handler in Next.js:

1. Import `createZodRoute` and `zod`.
2. Define validation schemas for params, query, body, and metadata as needed.
3. Use `createZodRoute()` to create a route handler, chaining `params`, `query`, `body`, and `defineMetadata` methods.
4. Implement your handler function, accessing validated and type-safe params, query, body, and metadata through `context`.

## Supported Body Formats

`next-zod-route` supports multiple request body formats out of the box:

- **JSON:** Automatically parses and validates JSON bodies.
- **URL Encoded:** Supports `application/x-www-form-urlencoded` data.
- **Multipart Form Data:** Supports `multipart/form-data`, enabling file uploads and complex form data parsing.

The library automatically detects the content type and parses the body accordingly. For GET and DELETE requests, body parsing is skipped.

## Response Handling

You can return responses in two ways:

1. **Return a Response object directly:**

```ts
return NextResponse.json({ data: 'value' }, { status: 200 });
```

2. **Return a plain object** that will be automatically converted to a JSON response with status 200:

```ts
return { data: 'value' };
```

## Response Validation

`next-zod-route` allows you to validate response bodies against Zod schemas based on HTTP status codes. This ensures that your API responses match the expected structure.

### Basic Usage

```ts
import { createZodRoute } from 'next-zod-route';
import { z } from 'zod';

const successSchema = z.object({
  success: z.boolean(),
  data: z.string(),
});

const errorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

export const GET = createZodRoute()
  .response(200, successSchema)
  .response(400, errorSchema)
  .handler((request, context) => {
    // This response will be validated against successSchema
    return Response.json({ success: true, data: 'Hello World' }, { status: 200 });
  });
```

### How It Works

- The `response()` method can be called multiple times to register schemas for different status codes
- After the handler completes, the response body is validated against the schema matching the response's status code
- If no schema is registered for a status code, validation is skipped
- If validation fails, a 500 error is returned with validation details
- Only JSON responses are validated (non-JSON responses are skipped)

### Validation Behavior

- **Successful validation**: The response is returned as-is
- **Validation failure**: Returns a 500 error with validation error details
- **No schema registered**: Validation is skipped, response is returned normally
- **Non-JSON responses**: Validation is skipped (e.g., text/plain, image/\*)
- **Plain object returns**: Automatically converted to a 200 response and validated against the 200 schema if registered

### Multiple Status Codes

You can register schemas for multiple status codes:

```ts
export const POST = createZodRoute()
  .response(201, z.object({ id: z.string(), created: z.boolean() }))
  .response(400, z.object({ error: z.string() }))
  .response(404, z.object({ error: z.string(), code: z.literal('NOT_FOUND') }))
  .handler((request, context) => {
    // Response will be validated based on the status code returned
    return Response.json({ id: '123', created: true }, { status: 201 });
  });
```

### Duplicate Status Codes

Registering the same status code twice is not allowed and will throw an error at runtime:

```ts
const route = createZodRoute().response(200, schema1);

// This will throw an error
route.response(200, schema2); // Error: Response schema for status code 200 has already been registered
```

### Combined with Request Validation

Response validation works seamlessly with request validation:

```ts
const paramsSchema = z.object({
  id: z.string(),
});

const responseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const GET = createZodRoute()
  .params(paramsSchema)
  .response(200, responseSchema)
  .handler((request, context) => {
    const { id } = context.params;
    // Both request params and response are validated
    return Response.json({ id, name: 'John Doe' }, { status: 200 });
  });
```

### Error Handling

When response validation fails, you can customize the error handling using `handleZodError`. If no `handleZodError` is provided, it defaults to a 500 error:

```ts
// Default behavior (500 error)
export const GET = createZodRoute()
  .response(200, z.object({ success: z.boolean(), data: z.string() }))
  .handler(() => {
    // Missing required 'data' field - will return 500
    return Response.json({ success: true }, { status: 200 });
  });

// Response will be:
// Status: 500
// Body: {
//   "message": "Invalid response: response body does not match schema for status 200",
//   "errors": [...]
// }

// Custom error handling
import { ZodError } from 'zod';

const handleZodError = (field: string, error: ZodError) => {
  if (field === 'response') {
    // Handle response validation errors differently
    return new Response(
      JSON.stringify({
        code: 'RESPONSE_VALIDATION_ERROR',
        message: 'Response does not match expected schema',
        errors: error.issues,
      }),
      { status: 422 },
    );
  }
  // Handle other validation errors
  return new Response(JSON.stringify({ field, errors: error.issues }), { status: 400 });
};

export const GET = createZodRoute({ handleZodError })
  .response(200, z.object({ success: z.boolean(), data: z.string() }))
  .handler(() => {
    return Response.json({ success: true }, { status: 200 });
  });
```

## Strict Mode

Strict mode enforces stricter validation rules for both request and response data. When enabled, it:

1. **Strips unknown properties** from validated data (using Zod's `strip()`)
2. **Ignores request data** (params, query, body) when no schema is defined
3. **Requires response validators** for all JSON responses
4. **Strips unknown properties** from response bodies before returning them

### Enabling Strict Mode

Enable strict mode by passing `strict: true` when creating a route:

```ts
export const GET = createZodRoute({ strict: true })
  .params(z.object({ id: z.string() }))
  .response(200, z.object({ success: z.boolean() }))
  .handler((request, context) => {
    return Response.json({ success: true }, { status: 200 });
  });
```

### Request Validation in Strict Mode

#### Stripping Unknown Properties

In strict mode, unknown properties are automatically stripped from validated request data:

```ts
const paramsSchema = z.object({
  id: z.string(),
});

export const GET = createZodRoute({ strict: true })
  .params(paramsSchema)
  .handler((request, context) => {
    // Even if request includes { id: '123', extra: 'data' },
    // context.params will only contain { id: '123' }
    const { id } = context.params;
    // extra property is stripped
    return Response.json({ id });
  });
```

#### Ignoring Data Without Schemas

In strict mode, if no schema is defined for params, query, or body, that data is ignored (set to empty object):

```ts
export const GET = createZodRoute({ strict: true }).handler((request, context) => {
  // Even if params include { id: '123', extra: 'data' },
  // context.params will be {}
  expect(context.params).toEqual({});
  expect(context.query).toEqual({});
  expect(context.body).toEqual({});
  return Response.json({ success: true });
});
```

This ensures that only explicitly defined and validated data is available in your handler.

### Response Validation in Strict Mode

#### Stripping Unknown Properties from Responses

In strict mode, unknown properties are stripped from response bodies before returning them:

```ts
const responseSchema = z.object({
  success: z.literal(true),
  error: z.literal(false),
  data: z.object({
    message: z.string(),
  }),
});

export const GET = createZodRoute({ strict: true })
  .response(200, responseSchema)
  .handler(() => {
    return Response.json(
      {
        success: true,
        error: false,
        data: {
          id: 123, // This will be stripped - not in schema
          message: 'Hello World',
        },
      },
      { status: 200 },
    );
  });

// Response will only contain:
// {
//   "success": true,
//   "error": false,
//   "data": {
//     "message": "Hello World"
//   }
// }
```

This works for nested objects at any depth:

```ts
const responseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    user: z.object({
      name: z.string(),
      profile: z.object({
        email: z.string(),
      }),
    }),
  }),
});

export const GET = createZodRoute({ strict: true })
  .response(200, responseSchema)
  .handler(() => {
    return Response.json(
      {
        success: true,
        data: {
          id: 123, // Stripped
          user: {
            id: 456, // Stripped
            name: 'John',
            age: 30, // Stripped
            profile: {
              id: 789, // Stripped
              email: 'john@example.com',
              phone: '123-456-7890', // Stripped
            },
          },
        },
      },
      { status: 200 },
    );
  });

// Response will only contain schema-defined properties:
// {
//   "success": true,
//   "data": {
//     "user": {
//       "name": "John",
//       "profile": {
//         "email": "john@example.com"
//       }
//     }
//   }
// }
```

#### Requiring Response Validators

In strict mode, all JSON responses must have a registered validator. If a JSON response is returned without a validator, a 500 error is returned:

```ts
export const GET = createZodRoute({ strict: true }).handler(() => {
  // This will return a 500 error because no validator is registered for 200
  return Response.json({ success: true }, { status: 200 });
});

// Response:
// Status: 500
// Body: {
//   "message": "Invalid response: response validator required for status code 200 in strict mode"
// }
```

Non-JSON responses (like `text/plain` or images) are exempt from this requirement:

```ts
export const GET = createZodRoute({ strict: true }).handler(() => {
  // This is allowed - non-JSON responses don't need validators
  return new Response('plain text', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
});
```

### Complete Example

Here's a complete example showing strict mode in action:

```ts
const paramsSchema = z.object({
  id: z.string().uuid(),
});

const querySchema = z.object({
  search: z.string(),
});

const responseSchema = z.object({
  id: z.string(),
  search: z.string(),
  message: z.string(),
});

export const GET = createZodRoute({ strict: true })
  .params(paramsSchema)
  .query(querySchema)
  .response(200, responseSchema)
  .handler((request, context) => {
    const { id } = context.params;
    const { search } = context.query;

    // Extra properties in response will be stripped
    return Response.json(
      {
        id,
        search,
        message: 'Hello World',
        extra: 'will-be-stripped', // Stripped - not in schema
        timestamp: Date.now(), // Stripped - not in schema
      },
      { status: 200 },
    );
  });
```

### When to Use Strict Mode

Use strict mode when:

- **API Contract Compliance**: You want to ensure responses match exactly what's documented in your API contract
- **Data Security**: You want to prevent accidentally leaking sensitive data through extra properties
- **Type Safety**: You want maximum type safety and want to catch issues at runtime
- **API Versioning**: You want strict control over what data is sent/received for API versioning

**Note:** Strict mode is opt-in and defaults to `false` for backward compatibility.

## Advanced Usage

## Create client

You can create a reusable client in a file, I recommend `/src/lib/route.ts` with the following content:

```tsx
import { createZodRoute } from 'next-zod-route';

const route = createZodRoute();

// Create other re-usable route
const authRoute = route.use(...)
```

### Static Parameters with Metadata

Metadata enable you to add **static parameters** to the route, for example to give permissions list to our application.

One powerful use case for metadata is defining required permissions for routes and checking them in middleware. This allows you to:

1. Declare permissions statically at the route level
2. Enforce permissions consistently across your application
3. Keep authorization logic separate from your route handlers

Here's how to implement permission-based authorization:

```ts
import { type MiddlewareFunction } from 'next-zod-route';

// Define a schema for permissions metadata
const permissionsMetadataSchema = z.object({
  requiredPermissions: z.array(z.string()).optional(),
});

// Create a middleware that checks permissions
const permissionCheckMiddleware: MiddlewareFunction = async ({ next, metadata, request }) => {
  // Get user permissions from auth header, token, or session
  const userPermissions = getUserPermissions(request);

  // If no required permissions in metadata, allow access
  if (!metadata?.requiredPermissions || metadata.requiredPermissions.length === 0) {
    return next({ context: { authorized: true } });
  }

  // Check if user has all required permissions
  const hasAllPermissions = metadata.requiredPermissions.every((permission) => userPermissions.includes(permission));

  if (!hasAllPermissions) {
    // Short-circuit with 403 Forbidden response
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'You do not have the required permissions',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Continue with authorized context
  return next({ context: { authorized: true } });
};

// Use in your route handlers
export const GET = createZodRoute()
  .defineMetadata(permissionsMetadataSchema)
  .use(permissionCheckMiddleware)
  .metadata({ requiredPermissions: ['read:users'] })
  .handler((request, context) => {
    // Only executed if user has 'read:users' permission
    return Response.json({ data: 'Protected data' });
  });

export const POST = createZodRoute()
  .defineMetadata(permissionsMetadataSchema)
  .use(permissionCheckMiddleware)
  .metadata({ requiredPermissions: ['write:users'] })
  .handler((request, context) => {
    // Only executed if user has 'write:users' permission
    return Response.json({ success: true });
  });

export const DELETE = createZodRoute()
  .defineMetadata(permissionsMetadataSchema)
  .use(permissionCheckMiddleware)
  .metadata({ requiredPermissions: ['admin:users'] })
  .handler((request, context) => {
    // Only executed if user has 'admin:users' permission
    return Response.json({ success: true });
  });
```

This pattern allows you to:

- Clearly document required permissions for each route
- Apply consistent authorization logic across your application
- Skip permission checks for public routes by not specifying required permissions
- Combine with other middleware for comprehensive request processing

### Middleware

You can add middleware to your route handler with the `use` method. Middleware functions can add data to the context that will be available in your handler.

```ts
import { type MiddlewareFunction, createZodRoute } from 'next-zod-route';

const loggingMiddleware: MiddlewareFunction = async ({ next }) => {
  console.log('Before handler');
  const startTime = performance.now();

  // next() returns a Promise<Response>
  const response = await next();

  const endTime = performance.now() - startTime;
  console.log(`After handler - took ${Math.round(endTime)}ms`);

  return response;
};

const authMiddleware: MiddlewareFunction = async ({ request, metadata, next }) => {
  try {
    // Get the token from the request headers
    const token = request.headers.get('authorization')?.split(' ')[1];

    // You can access metadata in middleware
    if (metadata?.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    // Validate the token and get the user
    const user = await validateToken(token);

    // Add context & continue chain
    // next() accepts an optional object with a context property
    const response = await next({
      context: { user }, // This context will be merged with existing context
    });

    // You can modify the response after the handler
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'X-User-Id': user.id,
      },
    });
  } catch (error) {
    // Errors in middleware are caught and handled by the error handler
    throw error;
  }
};

const permissionsMiddleware: MiddlewareFunction = async ({ metadata, next }) => {
  // Metadata are optional and type-safe
  const response = await next({
    context: { permissions: metadata?.permissions ?? ['read'] },
  });
  return response;
};

export const GET = createZodRoute()
  .defineMetadata(
    z.object({
      role: z.enum(['admin', 'user']),
      permissions: z.array(z.string()).optional(),
    }),
  )
  .use(loggingMiddleware)
  .use(authMiddleware)
  .use(permissionsMiddleware)
  .handler((request, context) => {
    // Access middleware data from context.data
    const { user, permissions } = context.data;
    // Access metadata from context.metadata
    const { role } = context.metadata!;

    return Response.json({ user, permissions, role });
  });
```

Middleware functions receive:

- `request`: The request object
- `context`: The context object with data from previous middlewares
- `metadata`: The validated metadata object (optional)
- `next`: Function to continue the chain and add context

The middleware can:

1. Execute code before/after the handler
2. Modify the response
3. Add context data through the chain
4. Short-circuit the chain by returning a Response
5. Throw errors that will be caught by the error handler

### Middleware Features

#### Pre/Post Handler Execution

```ts
import { type MiddlewareFunction } from 'next-zod-route';

const timingMiddleware: MiddlewareFunction = async ({ next }) => {
  console.log('Starting request...');
  const start = performance.now();

  const response = await next();

  const duration = performance.now() - start;
  console.log(`Request took ${duration}ms`);

  return response;
};
```

#### Response Modification

```ts
import { type MiddlewareFunction } from 'next-zod-route';

const headerMiddleware: MiddlewareFunction = async ({ next }) => {
  const response = await next();

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'X-Custom': 'value',
    },
  });
};
```

#### Context Chaining

```ts
import { type MiddlewareFunction } from 'next-zod-route';

const middleware1: MiddlewareFunction = async ({ next }) => {
  const response = await next({
    context: { value1: 'first' },
  });
  return response;
};

const middleware2: MiddlewareFunction = async ({ context, next }) => {
  // Access previous context
  console.log(context.value1); // 'first'

  const response = await next({
    context: { value2: 'second' },
  });
  return response;
};
```

#### Early Returns

```ts
import { type MiddlewareFunction } from 'next-zod-route';

const authMiddleware: MiddlewareFunction = async ({ next }) => {
  const isAuthed = false;

  if (!isAuthed) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return next();
};
```

### Migration Guide (v0.2.0)

If you're upgrading from v0.1.x to v0.2.0, there are some changes to the middleware system:

#### Before (v0.1.x)

```typescript
const authMiddleware = async () => {
  return { user: { id: 'user-123' } };
};

const route = createZodRoute()
  .use(authMiddleware)
  .handler((req, ctx) => {
    const { user } = ctx.data;
    return { data: user.id };
  });
```

#### After (v0.2.0)

```typescript
import { type MiddlewareFunction } from 'next-zod-route';

const authMiddleware: MiddlewareFunction = async ({ next }) => {
  // Execute code before handler
  console.log('Checking auth...');

  // Add context & continue chain
  const response = await next({
    context: { user: { id: 'user-123' } },
  });

  // Modify response or execute code after
  return new Response(response.body, {
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'X-User-Id': 'user-123',
    },
  });
};

const route = createZodRoute()
  .use(authMiddleware)
  .handler((req, ctx) => {
    const { user } = ctx.data;
    return { data: user.id };
  });
```

Key changes in v0.2.0:

1. Middleware must now accept an object with `request`, `context`, `metadata`, and `next`
2. Context is passed explicitly via `next({ context: {...} })`
3. Middleware can execute code before and after the handler
4. Middleware can modify the response
5. Middleware can short-circuit by returning a Response
6. Error handling in middleware is now consistent with handler error handling

### Custom Error Handler

You can specify a custom error handler function to handle errors thrown in your route handler or middleware:

```ts
import { createZodRoute } from 'next-zod-route';

// Create a custom error class
class CustomError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = 'CustomError';
  }
}

// Create a route with a custom error handler
const safeRoute = createZodRoute({
  handleServerError: (error: Error) => {
    if (error instanceof CustomError) {
      return new Response(JSON.stringify({ message: error.message }), { status: error.status });
    }

    // Default error response
    return new Response(JSON.stringify({ message: 'Internal server error' }), { status: 500 });
  },
});

export const GET = safeRoute
  .use(async () => {
    // This error will be caught by the custom error handler
    throw new CustomError('Middleware error', 400);
  })
  .handler((request, context) => {
    // This error will also be caught by the custom error handler
    throw new CustomError('Handler error', 400);
  });
```

By default, if no custom error handler is provided, the library will return a generic "Internal server error" message with a 500 status code to avoid information leakage.

### Custom Zod Validation Error Handling

You can customize how Zod validation errors (params, query, body, headers, metadata, response) are formatted by providing a `handleZodError` callback:

```ts
import { createZodRoute } from 'next-zod-route';
import { ZodError, z } from 'zod';

const handleZodError = (field: 'params' | 'query' | 'body' | 'headers' | 'metadata' | 'response', error: ZodError) => {
  // Customize the error response structure
  return new Response(
    JSON.stringify({
      code: 'VALIDATION_ERROR',
      field,
      message: `Validation failed for ${field}`,
      errors: error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join('.'),
        code: issue.code,
      })),
    }),
    { status: 422 }, // Use 422 Unprocessable Entity for validation errors
  );
};

const safeRoute = createZodRoute({
  handleZodError,
});

export const POST = safeRoute
  .body(z.object({ email: z.string().email(), name: z.string().min(1) }))
  .handler((request, context) => {
    return Response.json({ success: true });
  });
```

The `handleZodError` function receives:

- `field`: The type of field that failed validation ('params', 'query', 'body', 'headers', 'metadata', or 'response')
- `error`: A `ZodError` instance containing all validation error details (accessible via `error.issues`)

**Note:** `handleZodError` handles all Zod validation errors including request data (params, query, body, headers, metadata) and response validation. If `handleZodError` is not provided, response validation errors default to 500 status codes, while request validation errors default to 400.

### Using Both Error Handlers

You can use both `handleServerError` and `handleZodError` together:

```ts
const safeRoute = createZodRoute({
  handleServerError: (error: Error) => {
    // Handle unexpected server errors
    return new Response(JSON.stringify({ message: 'Internal server error' }), { status: 500 });
  },
  handleZodError: (field, error) => {
    // Handle validation errors with custom format
    return new Response(
      JSON.stringify({
        error: 'Validation failed',
        field,
        details: error.issues,
      }),
      { status: 400 },
    );
  },
});
```

## Validation Errors

When validation fails, the library returns appropriate error responses by default:

- Invalid params: `{ message: 'Invalid params', errors: [...] }` with status 400
- Invalid query: `{ message: 'Invalid query', errors: [...] }` with status 400
- Invalid body: `{ message: 'Invalid body', errors: [...] }` with status 400
- Invalid headers: `{ message: 'Invalid headers', errors: [...] }` with status 400
- Invalid metadata: `{ message: 'Invalid metadata', errors: [...] }` with status 400

You can customize these error responses using the `handleZodError` callback (see above).

## Tests

Tests are written using [Vitest](https://vitest.dev). To run the tests, use the following command:

```sh
pnpm test
```

## Contributing

Contributions are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
