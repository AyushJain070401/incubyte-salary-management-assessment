import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Tests that actually touch the DB override this in their own setup
      // file with a real test-database URL. The default here only exists
      // so env parsing doesn't reject during unit/route tests that mock
      // or never instantiate the prisma client.
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_unused',
      SUPABASE_URL: 'https://test.supabase.co',
      // Same value the auth tests use when signing test JWTs; must be
      // long enough to satisfy the env schema's min-length check.
      SUPABASE_JWT_SECRET: 'test-jwt-secret-at-least-16-chars-long',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
