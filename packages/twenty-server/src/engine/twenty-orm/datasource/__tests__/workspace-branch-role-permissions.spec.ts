import { type Pool } from 'pg';
import { FieldMetadataType } from 'twenty-shared/types';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { WorkspaceDataSource } from 'src/engine/twenty-orm/datasource/workspace-data-source';
import { type WorkspaceInternalContext } from 'src/engine/twenty-orm/interfaces/workspace-internal-context.interface';
import { type RolePermissionConfig } from 'src/engine/twenty-orm/types/role-permission-config.type';
const objectId = 'company';
const branchId = '11111111-1111-4111-8111-111111111111';
const fields = ['id', 'branchId', 'name'].map((name) =>
  getFlatFieldMetadataMock({
    id: name,
    universalIdentifier: name,
    name,
    objectMetadataId: objectId,
    type: name === 'name' ? FieldMetadataType.TEXT : FieldMetadataType.UUID,
  }),
);
const object = getFlatObjectMetadataMock({
  id: objectId,
  universalIdentifier: objectId,
  nameSingular: 'company',
  namePlural: 'companies',
  fieldIds: fields.map((f) => f.id),
  isSystem: false,
});
const empty = {
  byUniversalIdentifier: {},
  universalIdentifierById: {},
  universalIdentifiersByApplicationId: {},
};
const map = (entities: Array<{ id: string; universalIdentifier: string }>) => ({
  ...empty,
  byUniversalIdentifier: Object.fromEntries(
    entities.map((e) => [e.universalIdentifier, e]),
  ),
  universalIdentifierById: Object.fromEntries(
    entities.map((e) => [e.id, e.universalIdentifier]),
  ),
});
const permission = (canRead = true, canWrite = true) => ({
  [objectId]: {
    canReadObjectRecords: canRead,
    canUpdateObjectRecords: canWrite,
    canSoftDeleteObjectRecords: canWrite,
    canDestroyObjectRecords: canWrite,
    restrictedFields: {},
    rowLevelPermissionPredicates: [],
  },
});
const build = ({
  read = true,
  write = true,
  enabled = true,
  auth = 'apiKey',
  applicationRead = true,
  assigned = true,
}: {
  read?: boolean;
  write?: boolean;
  enabled?: boolean;
  auth?: 'apiKey' | 'user' | 'application';
  applicationRead?: boolean;
  assigned?: boolean;
} = {}) => {
  const query = jest.fn().mockResolvedValue({ rows: [] });
  const configuration = {
    workspaceId: '12345678-1234-4234-8234-123456789abc',
    enabled,
    revision: 1,
    branches: [
      {
        id: branchId,
        name: 'A',
        workspaceId: '12345678-1234-4234-8234-123456789abc',
        isActive: true,
      },
    ],
    grants: [
      {
        principal:
          auth === 'user'
            ? { type: 'workspaceMember', id: 'member' }
            : auth === 'application'
              ? { type: 'application', id: 'app' }
              : { type: 'apiKey', id: 'key' },
        branchId,
        operations: ['read', 'create', 'update', 'delete', 'restore'],
      },
    ],
  };
  const internalContext = {
    workspaceId: '12345678-1234-4234-8234-123456789abc',
    workspaceBranchConfiguration: configuration,
    flatObjectMetadataMaps: map([object]),
    flatFieldMetadataMaps: map(fields),
    objectIdByNameSingular: { company: objectId, recordShare: objectId },
    featureFlagsMap: {},
    flatRowLevelPermissionPredicateMaps: empty,
    flatRowLevelPermissionPredicateGroupMaps: empty,
    userWorkspaceRoleMap: assigned ? { 'user-workspace': 'actor' } : {},
    apiKeyRoleMap: assigned ? { key: 'actor' } : {},
    roleIdsWithAllRecordsAccess: ['actor', 'app-role', 'narrow'],
    eventEmitterService: { emitDatabaseBatchEvent: jest.fn() },
    coreDataSource: {
      getRepository: () => ({
        find: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      }),
    },
    recordStock: {
      assertRecordStockAvailable: jest.fn(),
      acquireRecordStock: jest.fn(),
      releaseRecordStock: jest.fn(),
    },
  } as unknown as WorkspaceInternalContext;
  const authContext =
    auth === 'apiKey'
      ? { type: auth, apiKey: { id: 'key' } }
      : auth === 'application'
        ? { type: auth, application: { id: 'app', defaultRoleId: 'app-role' } }
        : {
            type: auth,
            userWorkspaceId: 'user-workspace',
            workspaceMemberId: 'member',
            application: { id: 'app', defaultRoleId: 'app-role' },
          };
  const datasource = new WorkspaceDataSource({
    pool: { query } as unknown as Pool,
    internalContext,
    authContext: authContext as never,
    objectPermissionsByRoleId: {
      actor: permission(read, write),
      'app-role': permission(applicationRead, true),
      narrow: permission(false, false),
    } as never,
  });
  return { datasource, query };
};
describe('branch-scoped default repository role intersection', () => {
  it.each([undefined, { shouldBypassPermissionChecks: true }])(
    'applies actor roles and branch grants for config %j',
    async (config) => {
      const { datasource, query } = build();
      await datasource
        .getRepository('company', config as RolePermissionConfig, {
          shouldSkipEventEmission: true,
        })
        .find();
      expect(query).toHaveBeenCalled();
      expect(query.mock.calls[0][0].text).toContain('"branchId" = ANY(');
    },
  );
  it('denies reads without actor object permission even when bypass requested', async () => {
    const { datasource, query } = build({ read: false });
    await expect(
      datasource
        .getRepository('company', { shouldBypassPermissionChecks: true })
        .find(),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it('denies creation without actor write permission', async () => {
    const { datasource, query } = build({ write: false });
    await expect(
      datasource
        .getRepository(
          'company',
          { shouldBypassPermissionChecks: true },
          { shouldSkipEventEmission: true },
        )
        .insert({
          id: '22222222-2222-4222-8222-222222222222',
          name: 'allowed branch',
          branchId,
        }),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it('retains explicit narrower caller role', async () => {
    const { datasource, query } = build();
    await expect(
      datasource
        .getRepository('company', { intersectionOf: ['narrow'] })
        .find(),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it('intersects application role on delegated user requests without additional application branch grants', async () => {
    const allowed = build({ auth: 'user' });
    await allowed.datasource
      .getRepository('company', { shouldBypassPermissionChecks: true })
      .find();
    expect(allowed.query).toHaveBeenCalled();
    const denied = build({ auth: 'user', applicationRead: false });
    await expect(
      denied.datasource
        .getRepository('company', { shouldBypassPermissionChecks: true })
        .find(),
    ).rejects.toThrow();
    expect(denied.query).not.toHaveBeenCalled();
  });
  it('resolves direct application role and application branch grant', async () => {
    const { datasource, query } = build({ auth: 'application' });
    await datasource.getRepository('company').find();
    expect(query).toHaveBeenCalled();
  });
  it('rejects missing role before SQL', () => {
    const { datasource, query } = build({ assigned: false });
    expect(() =>
      datasource.getRepository('company', {
        shouldBypassPermissionChecks: true,
      }),
    ).toThrow('No role');
    expect(query).not.toHaveBeenCalled();
  });
  it('keeps disabled isolation legacy bypass behavior', async () => {
    const { datasource, query } = build({ enabled: false, read: false });
    await datasource
      .getRepository('company', { shouldBypassPermissionChecks: true })
      .find();
    expect(query).toHaveBeenCalled();
    expect(query.mock.calls[0][0].text).not.toContain('"branchId" = ANY(');
  });
});
