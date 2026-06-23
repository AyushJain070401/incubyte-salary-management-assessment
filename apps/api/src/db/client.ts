import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// One PrismaClient per process. Hot-reload via tsx replaces the module
// graph, which would otherwise leak connections; we pin the instance to
// globalThis so reloads reuse it.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
