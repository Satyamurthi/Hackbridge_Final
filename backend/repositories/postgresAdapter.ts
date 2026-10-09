import { IDatabaseAdapter, QueryResult } from './dbAdapter';
let pgPool: any = null;

export class PostgresAdapter implements IDatabaseAdapter {
  private pool: any;

  constructor(connectionStringOrConfig?: string | object) {
    try {
      const { Pool } = require('pg');
      if (!pgPool) {
        pgPool = typeof connectionStringOrConfig === 'string'
          ? new Pool({ connectionString: connectionStringOrConfig })
          : new Pool(connectionStringOrConfig || {
              connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hackbridge'
            });
      }
      this.pool = pgPool;
    } catch (err) {
      console.warn('[PostgresAdapter] pg module not loaded, using fallback.');
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool is not initialized. Ensure pg dependency is installed and DATABASE_URL is configured.');
    }
    const res = await this.pool.query(sql, params);
    return {
      rows: res.rows as T[],
      rowCount: res.rowCount ?? res.rows.length
    };
  }

  async transaction<T>(callback: (client: IDatabaseAdapter) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool is not initialized.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const adapterWrapper: IDatabaseAdapter = {
        query: async (sql, params) => {
          const res = await client.query(sql, params);
          return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
        },
        transaction: () => {
          throw new Error('Nested transactions not supported directly; use savepoints.');
        },
        close: async () => {}
      };
      const result = await callback(adapterWrapper);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      pgPool = null;
    }
  }
}
