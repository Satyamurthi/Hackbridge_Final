export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface IDatabaseAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (client: IDatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export class MemoryDatabaseAdapter implements IDatabaseAdapter {
  private tables: Map<string, any[]> = new Map();

  constructor() {
    this.initDefaultTables();
  }

  private initDefaultTables() {
    this.tables.set('tenants', []);
    this.tables.set('users', []);
    this.tables.set('hackathons', []);
    this.tables.set('companies', []);
    this.tables.set('problem_statements', []);
    this.tables.set('teams', []);
    this.tables.set('team_members', []);
    this.tables.set('submissions', []);
    this.tables.set('evaluation_assignments', []);
    this.tables.set('evaluation_scores', []);
    this.tables.set('submission_scores_aggregate', []);
    this.tables.set('talent_profiles', []);
    this.tables.set('hiring_interests', []);
    this.tables.set('audit_logs', []);
    this.tables.set('notifications', []);
  }

  public getTable(name: string): any[] {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
    return this.tables.get(name)!;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    // Basic SQL emulator for in-memory testing & offline execution
    const normalized = sql.trim().toLowerCase();
    
    // Quick handle for SELECT
    if (normalized.startsWith('select')) {
      for (const [tableName, rows] of this.tables.entries()) {
        if (normalized.includes(`from ${tableName}`) || normalized.includes(`from public.${tableName}`)) {
          let filtered = [...rows];
          // Simple where matching for common params
          return { rows: filtered as T[], rowCount: filtered.length };
        }
      }
    }
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(callback: (client: IDatabaseAdapter) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async close(): Promise<void> {
    this.tables.clear();
  }
}
