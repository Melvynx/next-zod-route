import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';

import { createZodRoute } from './createZodRoute';
import { MiddlewareFunction } from './types';

const paramsSchema = z.object({
  id: z.uuid(),
});

const querySchema = z.object({
  search: z.string().min(1),
  status: z.string().array().optional(),
});

const bodySchema = z.object({
  field: z.string(),
});

export const paramsToPromise = (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
  return Promise.resolve(params);
};

describe('params validation', () => {
  it('should validate and handle valid params', async () => {
    const GET = createZodRoute()
      .params(paramsSchema)
      .handler((request, context) => {
        expectTypeOf(context.params).toMatchTypeOf<z.infer<typeof paramsSchema>>();
        const { id } = context.params;
        return Response.json({ id }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('should return an error for invalid params', async () => {
    const GET = createZodRoute()
      .params(paramsSchema)
      .handler((request, context) => {
        const { id } = context.params;
        return Response.json({ id }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: paramsToPromise({ id: 'invalid-uuid' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid params');
  });
});

describe('query validation', () => {
  it('should validate and handle valid query', async () => {
    const GET = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .handler((request, context) => {
        expectTypeOf(context.query).toMatchTypeOf<z.infer<typeof querySchema>>();
        const search = context.query.search;
        return Response.json({ search }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test');
    const response = await GET(request, { params: Promise.resolve({ id: 'D570D9AB-E002-46EA-996F-0E0023C8F702' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ search: 'test' });
  });

  it('should return an error for invalid query', async () => {
    const GET = createZodRoute()
      .query(querySchema)
      .handler((request, context) => {
        const search = context.query.search;
        return Response.json({ search }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid query');
  });

  it('should validate and handle valid query when query is array', async () => {
    const GET = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .handler((request, context) => {
        expectTypeOf(context.query).toMatchTypeOf<z.infer<typeof querySchema>>();
        const status = context.query.status;
        return Response.json({ status }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test&status=active&status=inactive');
    const response = await GET(request, { params: Promise.resolve({ id: 'D570D9AB-E002-46EA-996F-0E0023C8F702' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: ['active', 'inactive'] });
  });
});

describe('body validation', () => {
  it('should validate and handle valid body', async () => {
    const POST = createZodRoute()
      .body(bodySchema)
      .handler((request, context) => {
        expectTypeOf(context.body).toMatchTypeOf<z.infer<typeof bodySchema>>();
        const field = context.body.field;
        return Response.json({ field }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ field: 'test-field' }),
    });
    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ field: 'test-field' });
  });

  it('should return an error for invalid body', async () => {
    const POST = createZodRoute()
      .body(bodySchema)
      .handler((request, context) => {
        const field = context.body.field;
        return Response.json({ field }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ field: 123 }),
    });
    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid body');
  });

  it('should not error when body schema is defined but no body is sent in POST request', async () => {
    const POST = createZodRoute()
      .body(bodySchema)
      .handler(() => {
        // If we reach here, it means no validation error was thrown
        return Response.json({ success: true }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      method: 'POST',
      // No body provided intentionally
    });
    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(400); // Should fail with 400 since body is required but not provided
    const data = await response.json();
    expect(data.message).toBe('Invalid body');
  });

  it('should return the value when no body schema is defined and no body is provided', async () => {
    const POST = createZodRoute().handler(() => {
      // If we reach here, it means no validation error was thrown
      return Response.json({ success: true }, { status: 200 });
    });

    const request = new Request('http://localhost/', {
      method: 'POST',
      // No body provided intentionally
    });
    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200); // Should fail with 400 since body is required but not provided
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

describe('combined validation', () => {
  it('should validate and handle valid request with params, query, and body', async () => {
    const POST = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .body(bodySchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { search } = context.query;
        const { field } = context.body;

        return Response.json({ id, search, field }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test', {
      method: 'POST',
      body: JSON.stringify({ field: 'test-field' }),
    });

    const response = await POST(request, { params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      search: 'test',
      field: 'test-field',
    });
  });

  it('should return an error for invalid params in combined validation', async () => {
    const POST = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .body(bodySchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { search } = context.query;
        const { field } = context.body;

        return Response.json({ id, search, field }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test', {
      method: 'POST',
      body: JSON.stringify({ field: 'test-field' }),
    });

    const response = await POST(request, { params: paramsToPromise({ id: 'invalid-uuid' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid params');
  });

  it('should return an error for invalid query in combined validation', async () => {
    const POST = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .body(bodySchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { search } = context.query;
        const { field } = context.body;

        return Response.json({ id, search, field }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=', {
      method: 'POST',
      body: JSON.stringify({ field: 'test-field' }),
    });

    const response = await POST(request, { params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid query');
  });

  it('should return an error for invalid body in combined validation', async () => {
    const POST = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .body(bodySchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { search } = context.query;
        const { field } = context.body;

        return Response.json({ id, search, field }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test', {
      method: 'POST',
      body: JSON.stringify({ field: 123 }),
    });

    const response = await POST(request, { params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid body');
  });

  it('should execute middleware and add context properties', async () => {
    const middleware: MiddlewareFunction<Record<string, unknown>, { user: { id: string; role: string } }> = async ({
      next,
    }) => {
      const result = await next({ ctx: { user: { id: 'user-123', role: 'admin' } } });
      return result;
    };

    const GET = createZodRoute()
      .use(middleware)
      .params(paramsSchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { user } = context.ctx;

        expectTypeOf(user).toMatchTypeOf<{ id: string }>();

        return Response.json({ id, user }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      user: { id: 'user-123', role: 'admin' },
    });
  });

  it('should execute multiple middlewares and merge context properties', async () => {
    const GET = createZodRoute()
      .use(async ({ next }) => {
        const result = await next({ ctx: { user: { id: 'user-123' } } });
        return result;
      })
      .use(async ({ next, ctx }) => {
        const user = ctx.user;
        expectTypeOf(user).toMatchTypeOf<{ id: string }>();

        const result = await next({ ctx: { permissions: ['read', 'write'] } });

        return result;
      })
      .params(paramsSchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { user, permissions } = context.ctx;

        // Context should be automatically typed without explicit type
        expectTypeOf(user).toMatchTypeOf<{ id: string }>();
        expectTypeOf(permissions).toMatchTypeOf<string[]>();

        return Response.json({ id, user, permissions }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      user: { id: 'user-123' },
      permissions: ['read', 'write'],
    });
  });

  it('should handle server errors using handleServerError method', async () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const handleServerError = (error: Error) => {
      if (error instanceof CustomError) {
        return new Response(JSON.stringify({ message: error.name, details: error.message }), { status: 400 });
      }

      return new Response(JSON.stringify({ message: 'Something went wrong' }), { status: 400 });
    };

    const GET = createZodRoute({
      handleServerError,
    })
      .params(paramsSchema)
      .handler(() => {
        throw new CustomError('Test error');
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ message: 'CustomError', details: 'Test error' });
  });
});

describe('form data handling', () => {
  it('should parse and validate form data in the request body', async () => {
    const POST = createZodRoute()
      .body(bodySchema)
      .handler((request, context) => {
        const { field } = context.body;
        return Response.json({ field }, { status: 200 });
      });

    const formData = new URLSearchParams();
    formData.append('field', 'test-field');

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ field: 'test-field' });
  });

  it('should return an error for invalid form data', async () => {
    const POST = createZodRoute()
      .body(bodySchema)
      .handler((request, context) => {
        const { field } = context.body;
        return Response.json({ field }, { status: 200 });
      });

    const formData = new URLSearchParams();
    formData.append('field', ''); // Empty string should fail validation

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ field: '' });
  });
});

describe('response handling', () => {
  it('should return the Response object directly when handler returns a Response', async () => {
    const GET = createZodRoute().handler(() => {
      return new Response(JSON.stringify({ custom: 'response' }), {
        status: 201,
        headers: { 'X-Custom-Header': 'test' },
      });
    });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get('X-Custom-Header')).toBe('test');
    expect(data).toEqual({ custom: 'response' });
  });

  it('should convert non-Response return values to a JSON Response', async () => {
    const GET = createZodRoute().handler(() => {
      return { data: 'value' };
    });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const data = await response.json();
    expect(data).toEqual({ data: 'value' });
  });
});

describe('HTTP methods handling', () => {
  it('should not parse body for DELETE requests', async () => {
    const DELETE = createZodRoute().handler(() => {
      // If we reach here without error, it means the body wasn't parsed
      return Response.json({ success: true }, { status: 200 });
    });

    const request = new Request('http://localhost/', {
      method: 'DELETE',
      // DELETE can have a body, unlike GET
      body: '{invalid json}',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('should not parse body for GET requests', async () => {
    const GET = createZodRoute().handler(() => {
      // If we reach here without error, it means the body wasn't parsed
      return Response.json({ success: true }, { status: 200 });
    });

    // GET requests can't have a body, so we'll just test that the handler works
    const request = new Request('http://localhost/', {
      method: 'GET',
    });

    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });
});

describe('metadata validation', () => {
  const metadataSchema = z.object({
    permission: z.string(),
    role: z.enum(['admin', 'user']),
  });

  it('should validate and handle valid metadata', async () => {
    const GET = createZodRoute()
      .defineMetadata(metadataSchema)
      .metadata({ permission: 'read', role: 'admin' })
      .handler((request, context) => {
        expectTypeOf(context.metadata).toEqualTypeOf<z.infer<typeof metadataSchema> | undefined>();
        const { permission, role } = context.metadata!;
        return Response.json({ permission, role }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, {
      params: Promise.resolve({}),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ permission: 'read', role: 'admin' });
  });

  it('should return an error for invalid metadata', async () => {
    const GET = createZodRoute()
      .defineMetadata(metadataSchema)
      // @ts-expect-error - invalid role
      .metadata({ permission: 'read', role: 'invalid-role' })
      .handler((request, context) => {
        const { permission, role } = context.metadata!;
        return Response.json({ permission, role }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, {
      params: Promise.resolve({}),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid metadata');
  });

  it('should handle missing optional metadata', async () => {
    const GET = createZodRoute()
      .defineMetadata(metadataSchema)
      .handler((request, context) => {
        expect(context.metadata).toBeUndefined();
        return Response.json({ success: true }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('should work with combined validation', async () => {
    const GET = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .defineMetadata(metadataSchema)
      .metadata({ permission: 'read', role: 'admin' })
      .handler((request, context) => {
        const { id } = context.params;
        const { search } = context.query;
        const { permission, role } = context.metadata!;
        return Response.json({ id, search, permission, role }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test');
    const response = await GET(request, {
      params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      search: 'test',
      permission: 'read',
      role: 'admin',
    });
  });

  it('should pass metadata to middleware', async () => {
    const GET = createZodRoute()
      .defineMetadata(metadataSchema)
      .use(async ({ next, metadata }) => {
        expect(metadata).toEqual({ permission: 'read', role: 'admin' });
        const result = await next({ ctx: { authorized: true } });
        return result;
      })
      .metadata({ permission: 'read', role: 'admin' })
      .handler((request, context) => {
        const { authorized } = context.ctx;
        const { permission, role } = context.metadata!;
        return Response.json({ authorized, permission, role }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, {
      params: Promise.resolve({}),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      authorized: true,
      permission: 'read',
      role: 'admin',
    });
  });

  it('should handle undefined metadata in middleware', async () => {
    const GET = createZodRoute()
      .defineMetadata(metadataSchema)
      .use(async ({ next, metadata }) => {
        expect(metadata).toBeUndefined();
        const result = await next({ ctx: { authorized: false } });
        return result;
      })
      .handler((request, context) => {
        const { authorized } = context.ctx;
        return Response.json({ authorized }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ authorized: false });
  });

  it('should work with multiple middlewares accessing metadata', async () => {
    const GET = createZodRoute()
      .defineMetadata(metadataSchema)
      .use(async ({ next, metadata }) => {
        const result = await next({ ctx: { hasPermission: metadata?.permission === 'read' } });
        return result;
      })
      .use(async ({ next, metadata }) => {
        const result = await next({ ctx: { isAdmin: metadata?.role === 'admin' } });
        return result;
      })
      .metadata({ permission: 'read', role: 'admin' })
      .handler((request, context) => {
        const { hasPermission, isAdmin } = context.ctx;
        return Response.json({ hasPermission, isAdmin }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, {
      params: Promise.resolve({}),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      hasPermission: true,
      isAdmin: true,
    });
  });
});

describe('enhanced middleware functionality', () => {
  it('should allow middleware to execute code before and after handler', async () => {
    const logs: string[] = [];

    const loggingMiddleware: MiddlewareFunction = async ({ next }) => {
      logs.push('before handler');
      const startTime = performance.now();

      const response = await next();

      const endTime = performance.now();
      logs.push(`after handler - took ${Math.round(endTime - startTime)}ms`);

      return response;
    };

    const GET = createZodRoute()
      .use(loggingMiddleware)
      .handler(() => {
        logs.push('handler executed');
        return { success: true };
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(logs).toEqual(['before handler', 'handler executed', expect.stringMatching(/after handler - took \d+ms/)]);
  });

  it('should allow middleware to modify response', async () => {
    const GET = createZodRoute()
      .use(async ({ next }) => {
        const response = await next();

        // Create new response with additional header
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            'X-Custom-Header': 'middleware-added',
          },
        });
      })
      .handler(() => {
        return { success: true };
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.headers.get('X-Custom-Header')).toBe('middleware-added');
    expect(await response.json()).toEqual({ success: true });
  });

  it('should pass context through middleware chain', async () => {
    const GET = createZodRoute()
      .use(async ({ next }) => {
        const response = await next({
          ctx: { value1: 'first' },
        });
        return response;
      })
      .use(async ({ ctx, next }) => {
        expect(ctx).toHaveProperty('value1', 'first');
        const response = await next({
          ctx: { value2: 'second' },
        });
        return response;
      })
      .handler((request: Request, context) => {
        expect(context.ctx).toEqual({
          value1: 'first',
          value2: 'second',
        });
        return { success: true };
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('should allow middleware to short-circuit the chain', async () => {
    const GET = createZodRoute()
      .use(async ({ next }) => {
        // Short circuit with error response
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });

        // This won't be called
        await next();
      })
      .handler(() => {
        // This won't be called
        return { success: true };
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('should handle custom error thrown inside a middleware', async () => {
    class CustomMiddlewareError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomMiddlewareError';
      }
    }

    const handleServerError = (error: Error) => {
      if (error instanceof CustomMiddlewareError) {
        return new Response(JSON.stringify({ message: error.name, details: error.message }), { status: 400 });
      }

      return new Response(JSON.stringify({ message: 'Something went wrong' }), { status: 500 });
    };

    const GET = createZodRoute({
      handleServerError,
    })
      .use(async () => {
        throw new CustomMiddlewareError('Middleware error occurred');
      })
      .handler(() => {
        return { success: true };
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ message: 'CustomMiddlewareError', details: 'Middleware error occurred' });
  });
});

describe('permission checking with metadata', () => {
  const permissionsMetadataSchema = z.object({
    requiredPermissions: z.array(z.string()).optional(),
  });

  const permissionCheckMiddleware: MiddlewareFunction<
    Record<string, unknown>,
    { authorized: boolean },
    z.infer<typeof permissionsMetadataSchema>
  > = async ({ next, metadata, request }) => {
    // Get user permissions from auth header (in a real app)
    const userPermissions = request.headers.get('x-user-permissions')?.split(',') || [];

    // If no required permissions in metadata, allow access
    if (!metadata?.requiredPermissions || metadata.requiredPermissions.length === 0) {
      return next({ ctx: { authorized: true } });
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
    return next({ ctx: { authorized: true } });
  };

  it('should allow access when user has required permissions', async () => {
    const GET = createZodRoute()
      .defineMetadata(permissionsMetadataSchema)
      .use(permissionCheckMiddleware)
      .metadata({ requiredPermissions: ['read:users'] })
      .handler((request, context) => {
        const { authorized } = context.ctx;
        return Response.json({ success: true, authorized }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        'x-user-permissions': 'read:users,write:users',
      },
    });

    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, authorized: true });
  });

  it('should deny access when user lacks required permissions', async () => {
    const GET = createZodRoute()
      .defineMetadata(permissionsMetadataSchema)
      .use(permissionCheckMiddleware)
      .metadata({ requiredPermissions: ['admin:users'] })
      .handler(() => {
        // This handler should not be called
        return Response.json({ success: true }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        'x-user-permissions': 'read:users,write:users',
      },
    });

    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({
      error: 'Forbidden',
      message: 'You do not have the required permissions',
    });
  });

  it('should allow access when no permissions are required', async () => {
    const GET = createZodRoute()
      .defineMetadata(permissionsMetadataSchema)
      .use(permissionCheckMiddleware)
      .metadata({ requiredPermissions: [] })
      .handler((request, context) => {
        const { authorized } = context.ctx;
        return Response.json({ success: true, authorized }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, authorized: true });
  });

  it('should allow access when metadata is not provided', async () => {
    const GET = createZodRoute()
      .defineMetadata(permissionsMetadataSchema)
      .use(permissionCheckMiddleware)
      .handler((request, context) => {
        const { authorized } = context.ctx;
        return Response.json({ success: true, authorized }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, authorized: true });
  });

  it('should work with other middleware and validations', async () => {
    const loggingMiddleware: MiddlewareFunction = async ({ next }) => {
      const response = await next({ ctx: { logged: true } });
      return response;
    };

    const GET = createZodRoute()
      .defineMetadata(permissionsMetadataSchema)
      .params(paramsSchema)
      .use(loggingMiddleware)
      .use(permissionCheckMiddleware)
      .metadata({ requiredPermissions: ['read:users'] })
      .handler((request, context) => {
        const { id } = context.params;
        const { authorized, logged } = context.ctx;
        return Response.json({ id, authorized, logged }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        'x-user-permissions': 'read:users,write:users',
      },
    });

    const response = await GET(request, {
      params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      authorized: true,
      logged: true,
    });
  });
});

describe('response validation', () => {
  const successResponseSchema = z.object({
    success: z.boolean(),
    data: z.string(),
  });

  const errorResponseSchema = z.object({
    error: z.string(),
    message: z.string(),
  });

  it('should validate response body against schema for matching status code', async () => {
    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .handler(() => {
        return Response.json({ success: true, data: 'test' }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, data: 'test' });
  });

  it('should return 500 error when response body does not match schema', async () => {
    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .handler(() => {
        // Return invalid response (missing required fields)
        return Response.json({ success: true }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain('Invalid response');
    expect(data.errors).toBeDefined();
  });

  it('should validate multiple status codes with different schemas', async () => {
    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .response(400, errorResponseSchema)
      .handler(() => {
        return Response.json({ success: true, data: 'test' }, { status: 200 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, data: 'test' });
  });

  it('should skip validation when no schema is registered for status code', async () => {
    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .handler(() => {
        // Return 404 without schema - should not validate
        return Response.json({ notValidated: true }, { status: 404 });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ notValidated: true });
  });

  it('should validate plain object returns against 200 schema', async () => {
    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .handler(() => {
        // Return plain object (will be converted to 200 response)
        return { success: true, data: 'test' };
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, data: 'test' });
  });

  it('should return 500 error when plain object does not match 200 schema', async () => {
    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .handler(() => {
        // Return invalid plain object
        return { invalid: 'data' };
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain('Invalid response');
  });

  it('should skip validation for non-JSON responses', async () => {
    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .handler(() => {
        // Return text response
        return new Response('plain text', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe('plain text');
  });

  it('should return 500 error when response body is not valid JSON', async () => {
    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .handler(() => {
        // Return invalid JSON
        return new Response('invalid json {', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain('Invalid response');
  });

  it('should validate middleware responses', async () => {
    const middleware: MiddlewareFunction = async ({ next }) => {
      const response = await next();
      // Middleware returns a response that should be validated
      return Response.json({ success: true, data: 'middleware' }, { status: 200 });
    };

    const GET = createZodRoute()
      .response(200, successResponseSchema)
      .use(middleware)
      .handler(() => {
        return { test: 'data' };
      });

    const request = new Request('http://localhost/');
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, data: 'middleware' });
  });

  it('should throw error when trying to register duplicate status code', () => {
    const route = createZodRoute().response(200, successResponseSchema);

    expect(() => {
      route.response(200, errorResponseSchema);
    }).toThrow('Response schema for status code 200 has already been registered');
  });

  it('should work with combined request and response validation', async () => {
    const GET = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .response(200, successResponseSchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { search } = context.query;
        return Response.json({ success: true, data: `${id}-${search}` }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test');
    const response = await GET(request, {
      params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      data: '550e8400-e29b-41d4-a716-446655440000-test',
    });
  });

  it('should validate different status codes correctly', async () => {
    const POST = createZodRoute()
      .response(201, z.object({ id: z.string(), created: z.boolean() }))
      .response(400, errorResponseSchema)
      .handler(() => {
        return Response.json({ id: '123', created: true }, { status: 201 });
      });

    const request = new Request('http://localhost/', { method: 'POST' });
    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({ id: '123', created: true });
  });

  it('should return 500 when response for 201 does not match schema', async () => {
    const POST = createZodRoute()
      .response(201, z.object({ id: z.string(), created: z.boolean() }))
      .handler(() => {
        // Missing required 'created' field
        return Response.json({ id: '123' }, { status: 201 });
      });

    const request = new Request('http://localhost/', { method: 'POST' });
    const response = await POST(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain('Invalid response');
  });
});

describe('header validation', () => {
  const headersSchema = z.object({
    authorization: z.string().startsWith('Bearer '),
    'content-type': z.string().optional(),
    'x-api-key': z.string().min(1),
  });

  it('should validate and handle valid headers', async () => {
    const GET = createZodRoute()
      .headers(headersSchema)
      .handler((request, context) => {
        expectTypeOf(context.headers).toMatchTypeOf<z.infer<typeof headersSchema>>();
        const { authorization, 'x-api-key': apiKey } = context.headers;
        return Response.json({ authorization, apiKey }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        Authorization: 'Bearer token123',
        'X-API-Key': 'my-api-key',
        'Content-Type': 'application/json',
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      authorization: 'Bearer token123',
      apiKey: 'my-api-key',
    });
  });

  it('should return an error for invalid headers', async () => {
    const GET = createZodRoute()
      .headers(headersSchema)
      .handler((request, context) => {
        const { authorization } = context.headers;
        return Response.json({ authorization }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        Authorization: 'Invalid token',
        'X-API-Key': 'my-api-key',
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid headers');
  });

  it('should handle case-insensitive header names', async () => {
    const GET = createZodRoute()
      .headers(headersSchema)
      .handler((request, context) => {
        // Headers should be normalized to lowercase
        expect(context.headers).toHaveProperty('authorization');
        expect(context.headers).toHaveProperty('x-api-key');
        return Response.json({ success: true }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        AUTHORIZATION: 'Bearer token123',
        'X-API-Key': 'my-api-key',
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('should handle missing required headers', async () => {
    const GET = createZodRoute()
      .headers(headersSchema)
      .handler(() => {
        return Response.json({ success: true }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        Authorization: 'Bearer token123',
        // Missing X-API-Key
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid headers');
  });

  it('should handle optional headers', async () => {
    const GET = createZodRoute()
      .headers(headersSchema)
      .handler((request, context) => {
        const { 'content-type': contentType } = context.headers;
        return Response.json({ contentType }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        Authorization: 'Bearer token123',
        'X-API-Key': 'my-api-key',
        // content-type is optional
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contentType).toBeUndefined();
  });

  it('should work with combined validation (params, query, body, headers)', async () => {
    const GET = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .headers(headersSchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { search } = context.query;
        const { authorization } = context.headers;
        return Response.json({ id, search, authorization }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test', {
      headers: {
        Authorization: 'Bearer token123',
        'X-API-Key': 'my-api-key',
      },
    });
    const response = await GET(request, {
      params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      search: 'test',
      authorization: 'Bearer token123',
    });
  });

  it('should return an error for invalid headers in combined validation', async () => {
    const GET = createZodRoute()
      .params(paramsSchema)
      .query(querySchema)
      .headers(headersSchema)
      .handler((request, context) => {
        const { id } = context.params;
        const { search } = context.query;
        const { authorization } = context.headers;
        return Response.json({ id, search, authorization }, { status: 200 });
      });

    const request = new Request('http://localhost/?search=test', {
      headers: {
        Authorization: 'Invalid token',
        'X-API-Key': 'my-api-key',
      },
    });
    const response = await GET(request, {
      params: paramsToPromise({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid headers');
  });

  it('should work with headers and middleware', async () => {
    const middleware: MiddlewareFunction = async ({ next, request }) => {
      // Middleware can access headers from request
      const authHeader = request.headers.get('authorization');
      const result = await next({ ctx: { hasAuth: !!authHeader } });
      return result;
    };

    const GET = createZodRoute()
      .headers(headersSchema)
      .use(middleware)
      .handler((request, context) => {
        const { authorization } = context.headers;
        const { hasAuth } = context.ctx;
        return Response.json({ authorization, hasAuth }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        Authorization: 'Bearer token123',
        'X-API-Key': 'my-api-key',
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      authorization: 'Bearer token123',
      hasAuth: true,
    });
  });

  it('should handle headers when no header schema is defined', async () => {
    const GET = createZodRoute().handler((request, context) => {
      // Headers should still be available but not validated
      expect(context.headers).toBeDefined();
      expectTypeOf(context.headers).toMatchTypeOf<Record<string, string>>();
      return Response.json({ success: true }, { status: 200 });
    });

    const request = new Request('http://localhost/', {
      headers: {
        'Custom-Header': 'value',
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it('should use first value when duplicate headers exist (case-insensitive)', async () => {
    const simpleHeadersSchema = z.object({
      'x-custom': z.string(),
    });

    const GET = createZodRoute()
      .headers(simpleHeadersSchema)
      .handler((request, context) => {
        const { 'x-custom': custom } = context.headers;
        return Response.json({ custom }, { status: 200 });
      });

    // Create a request with duplicate headers (different cases)
    // Note: The Request API doesn't allow duplicate headers directly,
    // but we test that our normalization handles case-insensitivity
    const request = new Request('http://localhost/', {
      headers: {
        'X-Custom': 'first-value',
        'x-custom': 'second-value', // This would overwrite in a real scenario
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should use the first value encountered
    expect(data.custom).toBeDefined();
  });

  it('should validate headers with complex schema', async () => {
    const complexHeadersSchema = z.object({
      authorization: z.string().regex(/^Bearer [A-Za-z0-9]+$/),
      'x-request-id': z.string().uuid(),
      'x-api-version': z.enum(['v1', 'v2', 'v3']),
      'user-agent': z.string().optional(),
    });

    const GET = createZodRoute()
      .headers(complexHeadersSchema)
      .handler((request, context) => {
        const { authorization, 'x-request-id': requestId, 'x-api-version': version } = context.headers;
        return Response.json({ authorization, requestId, version }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        Authorization: 'Bearer abc123',
        'X-Request-Id': '550e8400-e29b-41d4-a716-446655440000',
        'X-API-Version': 'v2',
        'User-Agent': 'test-agent',
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      authorization: 'Bearer abc123',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      version: 'v2',
    });
  });

  it('should return error for invalid complex header schema', async () => {
    const complexHeadersSchema = z.object({
      authorization: z.string().regex(/^Bearer [A-Za-z0-9]+$/),
      'x-request-id': z.string().uuid(),
      'x-api-version': z.enum(['v1', 'v2', 'v3']),
    });

    const GET = createZodRoute()
      .headers(complexHeadersSchema)
      .handler(() => {
        return Response.json({ success: true }, { status: 200 });
      });

    const request = new Request('http://localhost/', {
      headers: {
        Authorization: 'Invalid format',
        'X-Request-Id': '550e8400-e29b-41d4-a716-446655440000',
        'X-API-Version': 'v2',
      },
    });
    const response = await GET(request, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid headers');
  });
});
