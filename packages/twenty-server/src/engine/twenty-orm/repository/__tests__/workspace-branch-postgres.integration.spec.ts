import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { RelationType } from 'src/engine/metadata-modules/field-metadata/interfaces/relation-type.interface';
import { FieldMetadataType } from 'twenty-shared/types';

import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace-repository';
import { type WorkspaceTableShape } from 'src/engine/twenty-orm/table-shape/types/workspace-table-shape.type';

const databaseUrl = process.env.BRANCH_ISOLATION_TEST_DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('workspace branch enforcement against PostgreSQL', () => {
  const workspaceId = randomUUID();
  const branchA = randomUUID();
  const branchB = randomUUID();
  const recordA = randomUUID();
  const recordB = randomUUID();
  const otherTenantRecord = randomUUID();
  const schemaName = `branch_test_${randomUUID().replace(/-/g, '')}`;
  const otherSchemaName = `${schemaName}_other`;
  let pool: Pool;
  let repository: WorkspaceRepository;

  beforeAll(async () => {
    if (
      !databaseUrl ||
      new URL(databaseUrl).pathname !== '/branch_isolation_test'
    ) {
      throw new Error(
        'Branch integration tests require the dedicated branch_isolation_test database',
      );
    }
    pool = new Pool({ connectionString: databaseUrl, max: 2 });
    await pool.query(
      `CREATE SCHEMA "${schemaName}"; CREATE SCHEMA "${otherSchemaName}"`,
    );
    for (const schema of [schemaName, otherSchemaName]) {
      await pool.query(
        `CREATE TABLE "${schema}"."company" ("id" uuid PRIMARY KEY, "branchId" uuid, "parentId" uuid, "name" text, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(), "deletedAt" timestamptz)`,
      );
    }
    const fields = [
      ['id', FieldMetadataType.UUID],
      ['parentId', FieldMetadataType.UUID],
      ['branchId', FieldMetadataType.UUID],
      ['name', FieldMetadataType.TEXT],
      ['createdAt', FieldMetadataType.DATE_TIME],
      ['updatedAt', FieldMetadataType.DATE_TIME],
      ['deletedAt', FieldMetadataType.DATE_TIME],
    ].map(([name, type]) =>
      getFlatFieldMetadataMock({
        id: randomUUID(),
        universalIdentifier: randomUUID(),
        objectMetadataId: 'company',
        name,
        type,
      } as Parameters<typeof getFlatFieldMetadataMock>[0]),
    );
    const object = getFlatObjectMetadataMock({
      id: 'company',
      universalIdentifier: 'company',
      nameSingular: 'company',
      namePlural: 'companies',
      isSystem: false,
      fieldIds: fields.map((field) => field.id),
    });
    const fieldMaps = {
      byUniversalIdentifier: Object.fromEntries(
        fields.map((field) => [field.universalIdentifier, field]),
      ),
      universalIdentifierById: Object.fromEntries(
        fields.map((field) => [field.id, field.universalIdentifier]),
      ),
      universalIdentifiersByApplicationId: {},
    };
    const objectMaps = {
      byUniversalIdentifier: { company: object },
      universalIdentifierById: { company: 'company' },
      universalIdentifiersByApplicationId: {},
    };
    const tableShape: WorkspaceTableShape = {
      objectMetadataId: 'company',
      nameSingular: 'company',
      schemaName,
      tableName: 'company',
      columnNames: fields.map((field) => field.name),
      columnShapeByColumnName: Object.fromEntries(
        fields.map((field) => [
          field.name,
          {
            columnName: field.name,
            fieldMetadataId: field.id,
            fieldName: field.name,
            fieldMetadataType: field.type,
          },
        ]),
      ),
      relationShapeByFieldName: {
        parent: {
          fieldName: 'parent',
          fieldMetadataId: fields.find((field) => field.name === 'parentId')!
            .id,
          relationType: RelationType.MANY_TO_ONE,
          targetObjectMetadataId: 'company',
          targetFieldMetadataId: fields.find((field) => field.name === 'id')!
            .id,
          joinColumnName: 'parentId',
        },
      },
      hasDeletedAtColumn: true,
    };
    const emptyMaps = {
      byUniversalIdentifier: {},
      universalIdentifierById: {},
      universalIdentifiersByApplicationId: {},
    };
    repository = new WorkspaceRepository({
      tableShape,
      flatObjectMetadata: object,
      authContext: {
        type: 'apiKey',
        workspace: { id: workspaceId },
        apiKey: { id: 'key' },
      },
      internalContext: {
        workspaceId,
        workspaceBranchConfiguration: {
          workspaceId,
          enabled: true,
          revision: 1,
          branches: [
            { id: branchA, workspaceId, name: 'A', isActive: true },
            { id: branchB, workspaceId, name: 'B', isActive: true },
          ],
          grants: [
            {
              principal: { type: 'apiKey', id: 'key' },
              branchId: branchA,
              operations: ['read', 'create', 'update', 'delete', 'restore'],
            },
          ],
        },
        flatObjectMetadataMaps: objectMaps,
        flatFieldMetadataMaps: fieldMaps,
        objectIdByNameSingular: { company: 'company' },
        featureFlagsMap: {},
        apiKeyRoleMap: {},
        userWorkspaceRoleMap: {},
        roleIdsWithAllRecordsAccess: [],
        flatRowLevelPermissionPredicateMaps: emptyMaps,
        flatRowLevelPermissionPredicateGroupMaps: emptyMaps,
        coreDataSource: {},
        eventEmitterService: { emitDatabaseBatchEvent: jest.fn() },
        recordStock: {
          assertRecordStockAvailable: jest.fn(),
          acquireRecordStock: jest.fn(),
          releaseRecordStock: jest.fn(),
        },
      },
      objectRecordsPermissions: {
        company: {
          canReadObjectRecords: true,
          canUpdateObjectRecords: true,
          canSoftDeleteObjectRecords: true,
          canDestroyObjectRecords: true,
          restrictedFields: {},
        },
      },
      executor: {
        execute: async (statement) =>
          (await pool.query(statement.text, statement.values)).rows,
      },
      shouldBypassPermissionChecks: true,
      shouldSkipEventEmission: true,
      tableShapeByObjectMetadataId: () => tableShape,
      flatObjectMetadataByObjectMetadataId: () => object,
    } as unknown as ConstructorParameters<typeof WorkspaceRepository>[0]);
  }, 30000);

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE "${schemaName}"."company", "${otherSchemaName}"."company"`,
    );
    await pool.query(
      `INSERT INTO "${schemaName}"."company" (id, "branchId", name) VALUES ($1, $2, 'A'), ($3, $4, 'B')`,
      [recordA, branchA, recordB, branchB],
    );
    await pool.query(
      `INSERT INTO "${otherSchemaName}"."company" (id, "branchId", name) VALUES ($1, $2, 'Other tenant')`,
      [otherTenantRecord, branchA],
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(
        `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE; DROP SCHEMA IF EXISTS "${otherSchemaName}" CASCADE`,
      );
      await pool.end();
    }
  });

  it('scopes direct lookups, counts and aggregates to permitted branches and tenant', async () => {
    expect((await repository.find()).map((record) => record.id)).toEqual([
      recordA,
    ]);
    expect(await repository.findOne({ where: { id: recordB } })).toBeNull();
    expect(await repository.count()).toBe(1);
    const grouped = await repository
      .createQueryBuilder('company')
      .select('company.branchId', 'branch')
      .addSelect('COUNT(*)', 'total')
      .groupBy('company.branchId')
      .getRawMany();
    expect(grouped).toEqual([{ branch: branchA, total: '1' }]);
  });

  it('does not update or delete another branch by guessed record id', async () => {
    await repository.update({ id: recordB }, { name: 'Forbidden' });
    await repository.delete({ id: recordB });
    const rows = await pool.query(
      `SELECT name FROM "${schemaName}"."company" WHERE id=$1`,
      [recordB],
    );
    expect(rows.rows).toEqual([{ name: 'B' }]);
  });

  it('applies branch authorization to joined aliases without removing the visible parent', async () => {
    await pool.query(
      `UPDATE "${schemaName}"."company" SET "parentId"=$1 WHERE id=$2`,
      [recordB, recordA],
    );
    const rows = await repository
      .createQueryBuilder('company')
      .select('company.id', 'id')
      .addSelect('parent.id', 'parentId')
      .leftJoin('company.parent', 'parent')
      .getRawMany();
    expect(rows).toEqual([{ id: recordA, parentId: null }]);
  });

  it('rejects unauthorized creation and branch reassignment with unchanged stored state', async () => {
    await expect(
      repository.insert({
        id: randomUUID(),
        branchId: branchB,
        name: 'Forbidden',
      }),
    ).rejects.toThrow('Branch access denied');
    await expect(
      repository.update({ id: recordA }, { branchId: branchB }),
    ).rejects.toThrow('Branch');
    const rows = await pool.query(
      `SELECT "branchId" FROM "${schemaName}"."company" WHERE id=$1`,
      [recordA],
    );
    expect(rows.rows).toEqual([{ branchId: branchA }]);
  });

  it('does not restore soft-deleted records from an unauthorized branch', async () => {
    await pool.query(
      `UPDATE "${schemaName}"."company" SET "deletedAt"=now() WHERE id=$1`,
      [recordB],
    );
    await repository.restore({ id: recordB });
    const rows = await pool.query(
      `SELECT "deletedAt" IS NOT NULL AS deleted FROM "${schemaName}"."company" WHERE id=$1`,
      [recordB],
    );
    expect(rows.rows).toEqual([{ deleted: true }]);
  });
});
