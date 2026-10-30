import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

export type PersistenceMode = 'postgres' | 'memory';

export class PersistenceModeError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'PersistenceModeError';
    this.statusCode = statusCode;
  }
}

declare global {
  var _postgresPool: Pool | undefined;
}

let persistenceModeOverride: PersistenceMode | null = null;
let dbOverride: NodePgDatabase<typeof schema> | null = null;

export function setPersistenceModeOverride(mode: PersistenceMode | null): void {
  persistenceModeOverride = mode;
}

export function setPostgresDbOverride(
  customDb: NodePgDatabase<typeof schema> | null
): void {
  dbOverride = customDb;
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.SQL_HOST && process.env.SQL_DB_NAME);
}

/**
 * Resolves the active persistence mode ('postgres' | 'memory').
 * - In production (NODE_ENV === 'production'), 'postgres' is required and 'memory' is forbidden.
 * - If PERSISTENCE_MODE is explicitly set to 'postgres' or 'memory', honors that setting strictly.
 * - If unset in development/test, uses 'postgres' when SQL_HOST + SQL_DB_NAME are configured, otherwise 'memory'.
 */
export function getPersistenceMode(): PersistenceMode {
  if (persistenceModeOverride) {
    return persistenceModeOverride;
  }

  const rawMode = (process.env.PERSISTENCE_MODE || '').trim().toLowerCase();
  const isProd = process.env.NODE_ENV === 'production';

  if (rawMode === 'memory') {
    if (isProd) {
      throw new PersistenceModeError(
        'PERSISTENCE_MODE="memory" is forbidden when NODE_ENV="production". Configure PostgreSQL connection variables.',
        500
      );
    }
    return 'memory';
  }

  if (rawMode === 'postgres') {
    return 'postgres';
  }

  if (rawMode !== '') {
    throw new PersistenceModeError(
      `Invalid PERSISTENCE_MODE="${process.env.PERSISTENCE_MODE}". Expected "postgres" or "memory".`,
      500
    );
  }

  if (isProd) {
    return 'postgres';
  }

  return isPostgresConfigured() ? 'postgres' : 'memory';
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST || 'localhost',
      port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 5000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

/**
 * Returns the active Drizzle PostgreSQL database instance when in 'postgres' mode.
 * Fails fast if PostgreSQL environment variables are missing (unless a test dbOverride is set).
 */
export function requirePostgresDb(): NodePgDatabase<typeof schema> {
  if (dbOverride) {
    return dbOverride;
  }
  if (!isPostgresConfigured()) {
    throw new PersistenceModeError(
      'PostgreSQL persistence is active (PERSISTENCE_MODE="postgres"), but SQL_HOST or SQL_DB_NAME is not configured.',
      503
    );
  }
  return db;
}


