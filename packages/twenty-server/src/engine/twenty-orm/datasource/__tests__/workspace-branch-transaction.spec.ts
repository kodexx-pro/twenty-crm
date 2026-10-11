import { type Pool } from 'pg';

import { type WorkspaceInternalContext } from 'src/engine/twenty-orm/interfaces/workspace-internal-context.interface';
import { WorkspaceDataSource } from 'src/engine/twenty-orm/datasource/workspace-data-source';

const configuration = {
  workspaceId: 'workspace',
  enabled: true,
  revision: 1,
  branches: [],
  grants: [],
};
const buildDataSource = () => {
  const order: string[] = [];
  const client = {
    query: jest
      .fn()
      .mockImplementation(async (statement: string | { text: string }) => {
        order.push(typeof statement === 'string' ? statement : statement.text);
        return { rows: [] };
      }),
    release: jest.fn(),
  };
  const connect = jest.fn().mockResolvedValue(client);
  const context = {
    workspaceId: 'workspace',
    workspaceBranchConfiguration: configuration,
    loadWorkspaceBranchConfiguration: jest
      .fn()
      .mockResolvedValue(configuration),
    withWorkspaceBranchAccessLock: async <T>(operation: () => Promise<T>) => {
      order.push('ACCESS LOCK');
      const value = await operation();
      order.push('ACCESS UNLOCK');
      return value;
    },
    eventEmitterService: { emitDatabaseBatchEvent: jest.fn() },
    recordStock: {
      assertRecordStockAvailable: jest.fn(),
      acquireRecordStock: jest.fn(),
      releaseRecordStock: jest.fn(),
    },
  } as unknown as WorkspaceInternalContext;
  const dataSource = new WorkspaceDataSource({
    pool: { connect } as unknown as Pool,
    internalContext: context,
    authContext: { type: 'system', workspace: { id: 'workspace' } } as never,
    objectPermissionsByRoleId: {},
  });
  return { dataSource, order, client, connect, context };
};

describe('branch transaction boundaries', () => {
  it('holds the configuration access lock through the workspace commit', async () => {
    const { dataSource, order } = buildDataSource();
    await dataSource.transaction(async (scope) => {
      await scope.acquireAdvisoryLocks([
        JSON.stringify([
          'timeline-activity-merge',
          'workspace',
          'company',
          'record',
          null,
          'type',
        ]),
      ]);
    });
    expect(order[0]).toBe('ACCESS LOCK');
    expect(order[1]).toBe('BEGIN');
    expect(order[2]).toContain('pg_advisory_xact_lock');
    expect(order.slice(-2)).toEqual(['COMMIT', 'ACCESS UNLOCK']);
  });
  it('fails stale transactions before opening a workspace connection', async () => {
    const { dataSource, connect, context } = buildDataSource();
    jest
      .mocked(context.loadWorkspaceBranchConfiguration!)
      .mockResolvedValue({ ...configuration, revision: 2 });
    await expect(dataSource.transaction(async () => {})).rejects.toThrow(
      'Branch permissions changed',
    );
    expect(connect).not.toHaveBeenCalled();
  });
  it('rejects arbitrary transaction SQL when isolation is enabled', async () => {
    const { dataSource, client } = buildDataSource();
    await expect(
      dataSource.transaction(async (scope) => {
        await scope.executeRawQuery('SELECT * FROM company');
      }),
    ).rejects.toThrow('Raw transaction queries are unavailable');
    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);
  });
  it('rejects another workspace in the advisory-lock key', async () => {
    const { dataSource, client } = buildDataSource();
    await expect(
      dataSource.transaction(async (scope) => {
        await scope.acquireAdvisoryLocks([
          JSON.stringify([
            'timeline-activity-merge',
            'other-workspace',
            'company',
            'record',
            null,
            'type',
          ]),
        ]);
      }),
    ).rejects.toThrow('Invalid transaction lock');
    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);
  });
});
