import { FieldMetadataType } from 'twenty-shared/types';
import { type WorkspaceBranchAccessConfiguration } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';

import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type CompiledStatement } from 'src/engine/twenty-orm/sql/utils/compile-named-parameters.util';
import { WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace-repository';
import { type WorkspaceTableShape } from 'src/engine/twenty-orm/table-shape/types/workspace-table-shape.type';

type WorkspaceRepositoryOptions = ConstructorParameters<
  typeof WorkspaceRepository
>[0];

const OBJECT_METADATA_ID = 'delivery-object-id';

const buildField = (name: string, type: FieldMetadataType) =>
  getFlatFieldMetadataMock({
    id: `field-${name}`,
    universalIdentifier: `field-${name}`,
    objectMetadataId: OBJECT_METADATA_ID,
    name,
    type,
  });

const FIELDS = [
  buildField('branchId', FieldMetadataType.UUID),
  buildField('id', FieldMetadataType.UUID),
  buildField('state', FieldMetadataType.TEXT),
  buildField('attachments', FieldMetadataType.FILES),
  buildField('updatedAt', FieldMetadataType.DATE_TIME),
  buildField('deletedAt', FieldMetadataType.DATE_TIME),
];

const flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata> = {
  byUniversalIdentifier: Object.fromEntries(
    FIELDS.map((field) => [field.universalIdentifier, field]),
  ),
  universalIdentifierById: Object.fromEntries(
    FIELDS.map((field) => [field.id, field.universalIdentifier]),
  ),
  universalIdentifiersByApplicationId: {},
};

const flatObjectMetadata = getFlatObjectMetadataMock({
  id: OBJECT_METADATA_ID,
  universalIdentifier: OBJECT_METADATA_ID,
  nameSingular: 'delivery',
  namePlural: 'deliveries',
  isSystem: true,
  fieldIds: FIELDS.map((field) => field.id),
});

const flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata> = {
  byUniversalIdentifier: { [OBJECT_METADATA_ID]: flatObjectMetadata },
  universalIdentifierById: { [OBJECT_METADATA_ID]: OBJECT_METADATA_ID },
  universalIdentifiersByApplicationId: {},
};

const tableShape: WorkspaceTableShape = {
  objectMetadataId: OBJECT_METADATA_ID,
  nameSingular: 'delivery',
  schemaName: 'workspace_1wgvd1injqtife6y4rvfbu3h5',
  tableName: 'delivery',
  columnShapeByColumnName: Object.fromEntries(
    FIELDS.map((field) => [
      field.name,
      {
        columnName: field.name,
        fieldMetadataId: field.id,
        fieldName: field.name,
        fieldMetadataType: field.type,
      },
    ]),
  ),
  columnNames: FIELDS.map((field) => field.name),
  relationShapeByFieldName: {},
  hasDeletedAtColumn: true,
};

const EMPTY_FLAT_ENTITY_MAPS = {
  byUniversalIdentifier: {},
  universalIdentifierById: {},
  universalIdentifiersByApplicationId: {},
};
const API_KEY_ID = 'api-key-id';
const ROLE_ID = 'role-id';

const buildRepository = ({
  shouldBypassPermissionChecks = true,
  shouldSkipEventEmission,
  workspaceBranchConfiguration,
  loadWorkspaceBranchConfiguration,
  selectedBranchId,
  coreFiles = [],
}: {
  shouldBypassPermissionChecks?: boolean;
  shouldSkipEventEmission: boolean;
  workspaceBranchConfiguration?: WorkspaceBranchAccessConfiguration;
  loadWorkspaceBranchConfiguration?: () => Promise<WorkspaceBranchAccessConfiguration>;
  selectedBranchId?: string;
  coreFiles?: {
    id: string;
    workspaceId: string;
    settings: { branchId: string };
  }[];
}) => {
  const executedStatements: CompiledStatement[] = [];
  const coreFileRepository = {
    find: jest.fn().mockResolvedValue(coreFiles),
    update: jest.fn(),
  };

  const repository = new WorkspaceRepository({
    tableShape,
    flatObjectMetadata: workspaceBranchConfiguration
      ? { ...flatObjectMetadata, isSystem: false }
      : flatObjectMetadata,
    internalContext: {
      workspaceBranchConfiguration,
      loadWorkspaceBranchConfiguration,
      workspaceId: 'workspace-id',
      featureFlagsMap: {},
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      objectIdByNameSingular: { delivery: OBJECT_METADATA_ID },
      eventEmitterService: { emitDatabaseBatchEvent: jest.fn() },
      coreDataSource: { getRepository: () => coreFileRepository },
      recordStock: {
        assertRecordStockAvailable: jest.fn(),
        acquireRecordStock: jest.fn(),
        releaseRecordStock: jest.fn(),
      },
      userWorkspaceRoleMap: {},
      apiKeyRoleMap: { [API_KEY_ID]: ROLE_ID },
      roleIdsWithAllRecordsAccess: [ROLE_ID],
      flatRowLevelPermissionPredicateMaps: EMPTY_FLAT_ENTITY_MAPS,
      flatRowLevelPermissionPredicateGroupMaps: EMPTY_FLAT_ENTITY_MAPS,
    },
    authContext: {
      type: 'apiKey',
      apiKey: { id: API_KEY_ID },
      selectedBranchId,
    },
    executor: {
      execute: async (statement: CompiledStatement) => {
        executedStatements.push(statement);

        return [];
      },
    },
    objectRecordsPermissions: {
      [OBJECT_METADATA_ID]: {
        canReadObjectRecords: true,
        canUpdateObjectRecords: true,
        canSoftDeleteObjectRecords: true,
        canDestroyObjectRecords: true,
        restrictedFields: {},
      },
    },
    shouldBypassPermissionChecks,
    shouldSkipEventEmission,
    tableShapeByObjectMetadataId: () => tableShape,
  } as unknown as WorkspaceRepositoryOptions);

  const getExecutedStatementKinds = () =>
    executedStatements.map((statement) => statement.text.split(' ')[0]);

  return {
    repository,
    getExecutedStatementKinds,
    executedStatements,
    coreFileRepository,
  };
};

const branchConfiguration: WorkspaceBranchAccessConfiguration = {
  workspaceId: 'workspace-id',
  enabled: true,
  revision: 1,
  branches: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'A',
      workspaceId: 'workspace-id',
      isActive: true,
    },
  ],
  grants: [
    {
      principal: { type: 'apiKey', id: API_KEY_ID },
      branchId: '11111111-1111-4111-8111-111111111111',
      operations: ['read', 'create', 'update', 'delete', 'restore'],
    },
  ],
};

describe('mandatory workspace branch isolation', () => {
  it('constructs grouped records only from its scoped source', async () => {
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: branchConfiguration,
    });
    const source = repository
      .createQueryBuilder('delivery')
      .select('"delivery"."id"', 'record_id')
      .addSelect('"delivery"."state"', 'group_state')
      .addSelect('ROW_NUMBER() OVER ()', 'record_row_number');
    await repository.executeRankedRecords({
      source,
      groupAliases: ['group_state'],
      columnAliases: { id: 'record_id' },
      offset: 0,
      limit: 10,
    });
    expect(executedStatements[0].text).toContain('FROM (SELECT');
    expect(executedStatements[0].text).toContain('"branchId" = ANY(');
    expect(executedStatements[0].text).toContain('JSONB_AGG');
    expect(
      (repository as unknown as { executeScopedRead?: unknown })
        .executeScopedRead,
    ).toBeUndefined();
  });
  it('constructs lateral reads with scoped branches and rejects SQL in parent identifiers', async () => {
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: branchConfiguration,
    });
    const source = repository
      .createQueryBuilder('delivery')
      .select('"delivery"."id"', 'id');
    await repository.executeLateralRecordIds({
      source,
      parentIds: ['11111111-1111-4111-8111-111111111111'],
      limit: 10,
    });
    expect(executedStatements[0].text).toContain('CROSS JOIN LATERAL');
    expect(executedStatements[0].text).toContain('"branchId" = ANY(');
    await expect(
      repository.executeLateralRecordIds({
        source,
        parentIds: ["x') UNION SELECT id FROM company --"],
        limit: 10,
      }),
    ).rejects.toThrow('Invalid scoped relation page');
    expect(executedStatements).toHaveLength(1);
  });
  it('rejects noninteger scoped page limits before SQL', async () => {
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: branchConfiguration,
    });
    await expect(
      repository.executeRankedRecords({
        source: repository.createQueryBuilder('delivery'),
        groupAliases: ['state'],
        columnAliases: { id: 'id' },
        offset: 0,
        limit: NaN,
      }),
    ).rejects.toThrow('Invalid scoped record page');
    expect(executedStatements).toHaveLength(0);
  });

  it('intersects reads and counts even with permission bypass enabled', async () => {
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: branchConfiguration,
    });
    await repository.find();
    await repository.count();
    expect(executedStatements).toHaveLength(2);
    for (const statement of executedStatements) {
      expect(statement.text).toContain('"branchId" = ANY(');
      expect(statement.values).toContainEqual([
        '11111111-1111-4111-8111-111111111111',
      ]);
    }
  });
  it('rejects unauthorized explicit creations before executing SQL despite permission bypass', async () => {
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: branchConfiguration,
    });
    await expect(
      repository.insert({
        id: 'record',
        state: 'NEW',
        branchId: 'other-branch',
      }),
    ).rejects.toThrow('Branch access denied');
    expect(executedStatements).toHaveLength(0);
  });
  it.each([undefined, '11111111-1111-4111-8111-111111111111'])(
    'automatically assigns the only branch or authorized selected branch (%s)',
    async (selectedBranchId) => {
      const { repository, executedStatements } = buildRepository({
        shouldSkipEventEmission: true,
        workspaceBranchConfiguration: branchConfiguration,
        selectedBranchId,
      });
      await repository.insert({ id: 'record', state: 'NEW' });
      expect(executedStatements[0].text).toMatch(/^INSERT/);
      expect(executedStatements[0].values).toContain(
        '11111111-1111-4111-8111-111111111111',
      );
    },
  );
  it('rejects a selected unauthorized branch before SQL', async () => {
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: branchConfiguration,
      selectedBranchId: 'other-branch',
    });
    await expect(
      repository.insert({ id: 'record', state: 'NEW' }),
    ).rejects.toThrow('Branch access denied');
    expect(executedStatements).toHaveLength(0);
  });
  it('requires an explicit branch in all-branches context with multiple creation grants', async () => {
    const configuration = {
      ...branchConfiguration,
      branches: [
        ...branchConfiguration.branches,
        {
          id: '22222222-2222-4222-8222-222222222222',
          workspaceId: 'workspace-id',
          name: 'B',
          isActive: true,
        },
      ],
      grants: [
        ...branchConfiguration.grants,
        {
          principal: { type: 'apiKey' as const, id: API_KEY_ID },
          branchId: '22222222-2222-4222-8222-222222222222',
          operations: ['create' as const],
        },
      ],
    };
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: configuration,
    });
    await expect(
      repository.insert({ id: 'record', state: 'NEW' }),
    ).rejects.toThrow('Select an authorized branch');
    expect(executedStatements).toHaveLength(0);
  });
  it('rejects a foreign-branch file without record SQL or permanent file mutation', async () => {
    const { repository, executedStatements, coreFileRepository } =
      buildRepository({
        shouldSkipEventEmission: true,
        workspaceBranchConfiguration: branchConfiguration,
        coreFiles: [
          {
            id: 'foreign-file',
            workspaceId: 'workspace-id',
            settings: { branchId: 'other-branch' },
          },
        ],
      });
    await expect(
      repository.insert({
        id: 'record',
        state: 'NEW',
        attachments: [{ fileId: 'foreign-file' }],
      }),
    ).rejects.toThrow('Files must belong');
    expect(executedStatements).toHaveLength(0);
    expect(coreFileRepository.update).not.toHaveBeenCalled();
  });
  it('denies raw queries that cannot prove their branch predicate', async () => {
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: branchConfiguration,
    });
    await expect(
      repository.executeRaw('SELECT * FROM delivery', {}),
    ).rejects.toThrow('Raw record queries are unavailable');
    expect(executedStatements).toHaveLength(0);
  });
  it('rejects stale background job grants before returning data', async () => {
    const { repository, executedStatements } = buildRepository({
      shouldSkipEventEmission: true,
      workspaceBranchConfiguration: branchConfiguration,
      loadWorkspaceBranchConfiguration: async () => ({
        ...branchConfiguration,
        revision: 2,
        grants: [],
      }),
    });
    await expect(repository.find()).rejects.toThrow(
      'Branch permissions changed',
    );
    expect(executedStatements).toHaveLength(0);
  });
});

describe('WorkspaceRepository mutations', () => {
  describe('on a repository that bypasses permission checks and skips events', () => {
    it('should update without reading a before-image', async () => {
      const { repository, getExecutedStatementKinds } = buildRepository({
        shouldSkipEventEmission: true,
      });

      await repository.update({ id: 'delivery-id' }, { state: 'SENT' });

      expect(getExecutedStatementKinds()).toEqual(['UPDATE']);
    });

    it.each([
      ['delete', 'DELETE'],
      ['softDelete', 'UPDATE'],
      ['restore', 'UPDATE'],
    ] as const)(
      'should %s without reading a before-image',
      async (method, statementKind) => {
        const { repository, getExecutedStatementKinds } = buildRepository({
          shouldSkipEventEmission: true,
        });

        await repository[method]({ id: 'delivery-id' });

        expect(getExecutedStatementKinds()).toEqual([statementKind]);
      },
    );

    it('should still read the before-image when an update touches a files field', async () => {
      const { repository, getExecutedStatementKinds } = buildRepository({
        shouldSkipEventEmission: true,
      });

      await expect(
        repository.update({ id: 'delivery-id' }, { attachments: [] }),
      ).rejects.toThrow('Cannot update multiple records with files field');

      expect(getExecutedStatementKinds()).toEqual(['SELECT']);
    });
  });

  describe('on a repository that emits events', () => {
    it('should read the before- and after-image around an update', async () => {
      const { repository, getExecutedStatementKinds } = buildRepository({
        shouldSkipEventEmission: false,
      });

      await repository.update({ id: 'delivery-id' }, { state: 'SENT' });

      expect(getExecutedStatementKinds()).toEqual([
        'SELECT',
        'UPDATE',
        'SELECT',
      ]);
    });

    it('should read the before-image before a delete', async () => {
      const { repository, getExecutedStatementKinds } = buildRepository({
        shouldSkipEventEmission: false,
      });

      await repository.delete({ id: 'delivery-id' });

      expect(getExecutedStatementKinds()).toEqual(['SELECT', 'DELETE']);
    });
  });

  describe('on a permission-scoped repository that skips events', () => {
    it('should read the before-image before an update', async () => {
      const { repository, getExecutedStatementKinds } = buildRepository({
        shouldBypassPermissionChecks: false,
        shouldSkipEventEmission: true,
      });

      await repository.update({ id: 'delivery-id' }, { state: 'SENT' });

      expect(getExecutedStatementKinds()).toEqual(['SELECT', 'UPDATE']);
    });

    it('should read the before-image before a delete', async () => {
      const { repository, getExecutedStatementKinds } = buildRepository({
        shouldBypassPermissionChecks: false,
        shouldSkipEventEmission: true,
      });

      await repository.delete({ id: 'delivery-id' });

      expect(getExecutedStatementKinds()).toEqual(['SELECT', 'DELETE']);
    });
  });
});
