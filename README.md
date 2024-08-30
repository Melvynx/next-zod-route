<h1 align="center">next-zod-route</h1>

A fork from [next-safe-route](https://github.com/richardsolomou/next-safe-route) that uses [zod](https://github.com/colinhacks/zod) instead of [typeschema](https://github.com/typeschema/main).

<p align="center">
  <a href="https://www.npmjs.com/package/next-zod-route"><img src="https://img.shields.io/npm/v/next-zod-route?style=for-the-badge&logo=npm" /></a>
  <a href="https://github.com/melvynxdev/next-zod-route/actions/workflows/test.yaml"><img src="https://img.shields.io/github/actions/workflow/status/melvynxdev/next-zod-route/test.yaml?style=for-the-badge&logo=vitest" /></a>
  <a href="https://github.com/melvynxdev/next-zod-route/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/next-zod-route?style=for-the-badge" /></a>
</p>

`next-zod-route` is a utility library for Next.js that provides type-safety and schema validation for [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)/API Routes.

## Features

- **✅ Schema Validation:** Automatically validates request parameters, query strings, and body content with built-in error handling.
- **🧷 Type-Safe:** Works with full TypeScript type safety for parameters, query strings, and body content.
- **😌 Easy to Use:** Simple and intuitive API that makes defining route handlers a breeze.
- **🔗 Extensible:** Compatible with any validation library supported by [TypeSchema](https://typeschema.com).
- **🧪 Fully Tested:** Extensive test suite to ensure everything works reliably.

## Installation

```sh
npm install next-zod-route
```

The library only works with [zod](https://zod.dev) for schema validation.

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
  .body(bodySchema)
  .handler((request, context) => {
    const { id } = context.params;
    const { search } = context.query;
    const { field } = context.body;

    return Response.json({ id, search, field }), { status: 200 };
  });
```

To define a route handler in Next.js:

1. Import `createZodRoute` and your validation library (default, `zod`).
2. Define validation schemas for params, query, and body as needed.
3. Use `createZodRoute()` to create a route handler, chaining `params`, `query`, and `body` methods.
4. Implement your handler function, accessing validated and type-safe params, query, and body through `context`.

## Advanced Usage

### Middleware

You can add middleware to your route handler with the `use` method.

```ts
const safeRoute = createSafeRoute()
  .use(async (request, context) => {
    return { user: { id: 'user-123', role: 'admin' } };
  })
  .handler((request, context) => {
    const user = context.data.user;
    return Response.json({ user }, { status: 200 });
  });
```

Ensure that the middleware returns an object. The returned object will be merged with the context object.

### Custom Error Handler

You can specify a custom error handler function with the `handleServerError` method.

To achieve this, define a custom error handler when creating the `safeRoute`:

```ts
class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomError';
  }
}

const safeRoute = createSafeRoute({
  handleServerError: (error: Error) => {
    if (error instanceof CustomError) {
      return new Response(JSON.stringify({ message: error.name, details: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ message: 'Something went wrong' }), { status: 400 });
  },
});

const GET = safeRoute.handler((request, context) => {
  // This error will be handled by the custom error handler
  throw new CustomError('Test error');
});
```

By default, to avoid any information leakage, the error handler will always return a generic error message.

## Tests

Tests are written using [Vitest](https://vitest.dev). To run the tests, use the following command:

```sh
pnpm test
```

## Contributing

Contributions are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
