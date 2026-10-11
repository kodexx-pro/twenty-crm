import { FieldMetadataType, IndexType } from 'twenty-shared/types';
import { type DataSource } from 'typeorm';

import { KeyValuePairEntity } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { type WorkspaceBranchAccessConfiguration } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { WorkspaceBranchProvisioningService } from 'src/engine/core-modules/workspace-branch/workspace-branch-provisioning.service';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { type FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { IndexMetadataEntity } from 'src/engine/metadata-modules/index-metadata/index-metadata.entity';
import { type IndexMetadataService } from 'src/engine/metadata-modules/index-metadata/services/index-metadata.service';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';

const workspaceId = '20202020-1c25-4d02-bf25-6aeccf7ea419';
const branchId = '20202020-81ee-42da-a281-668632f32fe7';
const memberId = '20202020-71ee-42da-a281-668632f32fe7';
const company = {
  id: 'company-object',
  nameSingular: 'company',
  labelPlural: 'Companies',
  isSystem: true,
  isRemote: false,
};
const person = {
  id: 'person-object',
  nameSingular: 'person',
  labelPlural: 'People',
  isSystem: true,
  isRemote: false,
};
const member = {
  id: 'member-object',
  nameSingular: 'workspaceMember',
  labelPlural: 'Employees',
  isSystem: true,
  isRemote: false,
};
const branchField = (objectMetadataId = company.id) => ({
  id: `branch-field-${objectMetadataId}`,
  objectMetadataId,
  name: 'branchId',
  type: FieldMetadataType.UUID,
  isSystem: true,
  isActive: true,
  isUIEditable: false,
});

const fixture = () => {
  let objects = [company];
  let fields: Record<string, unknown>[] = [branchField()];
  let indexes: Record<string, unknown>[] = [];
  const configuration: WorkspaceBranchAccessConfiguration = {
    workspaceId,
    enabled: false,
    revision: 1,
    branches: [{ id: branchId, workspaceId, name: 'North', isActive: true }],
    grants: [],
  };
  const query = jest.fn(
    async (
      _sql: string,
      _parameters?: unknown[],
    ): Promise<{ count?: string; id?: string }[]> => [{ count: '0' }],
  );
  const runner = {
    connect: jest.fn(),
    query: jest.fn().mockResolvedValue([{ locked: true }]),
    release: jest.fn(),
  };
  const repository = (entity: unknown) => {
    if (entity === ObjectMetadataEntity)
      return { find: jest.fn(async () => objects) };
    if (entity === FieldMetadataEntity)
      return { find: jest.fn(async () => fields) };
    if (entity === IndexMetadataEntity)
      return { find: jest.fn(async () => indexes) };
    if (entity === KeyValuePairEntity)
      return { findOne: jest.fn(async () => ({ value: configuration })) };
    throw new Error('Unexpected repository');
  };
  const source = {
    getRepository: repository,
    query,
    createQueryRunner: () => runner,
    transaction: async (callback: (manager: unknown) => unknown) =>
      callback({ getRepository: repository, query }),
  } as unknown as DataSource;
  const createManyFields = jest.fn(
    async ({
      createFieldInputs,
    }: {
      createFieldInputs: { objectMetadataId: string }[];
    }) => {
      fields.push(
        ...createFieldInputs.map((input) =>
          branchField(input.objectMetadataId),
        ),
      );
      return [];
    },
  );
  const createOne = jest.fn();
  const service = new WorkspaceBranchProvisioningService(
    source,
    { createManyFields } as unknown as FieldMetadataService,
    { createOne } as unknown as IndexMetadataService,
  );
  return {
    service,
    configuration,
    query,
    runner,
    createManyFields,
    createOne,
    setObjects: (next: typeof objects) => {
      objects = next;
    },
    setFields: (next: typeof fields) => {
      fields = next;
    },
    setIndexes: (next: typeof indexes) => {
      indexes = next;
    },
  };
};

it('rejects activation with unclassified or unknown branch records', async () => {
  const { service, configuration, query } = fixture();
  query.mockImplementation(async (sql) => [
    { count: sql.includes('"branchId" IS NULL') ? '1' : '0' },
  ]);
  await expect(
    service.validateActivation(workspaceId, configuration),
  ).rejects.toThrow('Assign all records');
});

it.each([
  { isSystem: false },
  { type: FieldMetadataType.TEXT },
  { isActive: false },
  { isUIEditable: true },
])('rejects conflicting branch ownership metadata %j', async (override) => {
  const { service, configuration, setFields } = fixture();
  setFields([{ ...branchField(), ...override }]);
  await expect(
    service.validateActivation(workspaceId, configuration),
  ).rejects.toThrow('Prepare branch ownership');
});

it('rejects missing or differently owned attachment files', async () => {
  const { service, configuration, query } = fixture();
  query.mockImplementation(async (sql) => [
    { count: sql.includes('LEFT JOIN core."file"') ? '1' : '0' },
  ]);
  await expect(
    service.validateActivation(workspaceId, configuration),
  ).rejects.toThrow('attachment file ownership');
  expect(query).toHaveBeenLastCalledWith(
    expect.stringContaining('f."workspaceId" = $1'),
    [workspaceId],
  );
});

it.each([FieldMetadataType.RELATION, FieldMetadataType.MORPH_RELATION])(
  'rejects a cross-branch outgoing %s relationship',
  async (type) => {
    const { service, configuration, setFields, setObjects, query } = fixture();
    setObjects([company, person]);
    setFields([
      branchField(),
      branchField(person.id),
      {
        id: 'person-relation',
        name: 'person',
        label: 'Person',
        objectMetadataId: company.id,
        relationTargetObjectMetadataId: person.id,
        type,
        settings: { relationType: 'MANY_TO_ONE', joinColumnName: 'personId' },
      },
    ]);
    query.mockImplementation(async (sql) => [
      {
        count: sql.includes(
          'target."branchId" IS DISTINCT FROM source."branchId"',
        )
          ? '1'
          : '0',
      },
    ]);
    await expect(
      service.validateActivation(workspaceId, configuration),
    ).rejects.toThrow('cross-branch or unauthorized relationships');
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('source."personId"'),
      [],
    );
  },
);

it('rejects employee assignments without matching branch read grants', async () => {
  const { service, configuration, setFields, setObjects, query } = fixture();
  setObjects([company, member]);
  setFields([
    branchField(),
    {
      name: 'owner',
      label: 'Owner',
      objectMetadataId: company.id,
      relationTargetObjectMetadataId: member.id,
      type: FieldMetadataType.RELATION,
      settings: { relationType: 'MANY_TO_ONE', joinColumnName: 'ownerId' },
    },
  ]);
  query.mockImplementation(async (sql) => [
    { count: sql.includes('jsonb_to_recordset') ? '1' : '0' },
  ]);
  await expect(
    service.validateActivation(workspaceId, configuration),
  ).rejects.toThrow('unauthorized relationships');
  expect(query).toHaveBeenLastCalledWith(
    expect.stringContaining('target."deletedAt" IS NOT NULL'),
    ['[]'],
  );
});

it.each(['workspaceMember', 'apiKey', 'application'] as const)(
  'rejects an inactive or foreign-tenant %s principal',
  async (type) => {
    const { service, query } = fixture();
    query.mockResolvedValue([]);
    await expect(
      service.validatePrincipals(workspaceId, [{ type, id: memberId }]),
    ).rejects.toThrow('does not belong');
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      type === 'workspaceMember' ? [memberId] : [memberId, workspaceId],
    );
  },
);

it('supports non-expiring API keys without ignoring tenant ownership', async () => {
  const { service, query } = fixture();
  query.mockResolvedValue([{ id: memberId }]);
  await service.validatePrincipals(workspaceId, [
    { type: 'apiKey', id: memberId },
  ]);
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('("expiresAt" IS NULL OR "expiresAt" > NOW())'),
    [memberId, workspaceId],
  );
});

it('prepares protected fields and metadata indexes while enabled without assigning records', async () => {
  const {
    service,
    configuration,
    setFields,
    createManyFields,
    createOne,
    query,
    runner,
  } = fixture();
  configuration.enabled = true;
  setFields([]);
  await expect(service.prepare(workspaceId)).resolves.toEqual({
    objectsPrepared: 1,
    recordsAssigned: 0,
  });
  expect(createManyFields).toHaveBeenCalledWith(
    expect.objectContaining({
      workspaceId,
      isSystemBuild: true,
      createFieldInputs: [
        expect.objectContaining({
          name: 'branchId',
          isSystem: true,
          isUIEditable: false,
          isNullable: true,
        }),
      ],
    }),
  );
  expect(createOne).toHaveBeenCalledWith({
    workspaceId,
    createIndexInput: {
      objectMetadataId: company.id,
      fields: [{ fieldMetadataId: branchField().id }],
      indexType: IndexType.BTREE,
    },
  });
  expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE'))).toBe(false);
  expect(runner.query).toHaveBeenLastCalledWith(
    'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
    [`workspace-branch-prepare:${workspaceId}`],
  );
  expect(runner.release).toHaveBeenCalled();
});

it('reuses a BTREE index whose leading column is branch ownership', async () => {
  const { service, setIndexes, createOne } = fixture();
  setIndexes([
    {
      objectMetadataId: company.id,
      indexType: IndexType.BTREE,
      indexFieldMetadatas: [{ fieldMetadataId: branchField().id, order: 0 }],
    },
  ]);
  await service.prepare(workspaceId);
  expect(createOne).not.toHaveBeenCalled();
});

it('refuses record assignment while isolation is enabled', async () => {
  const { service, configuration, runner } = fixture();
  configuration.enabled = true;
  await expect(service.prepare(workspaceId, branchId)).rejects.toThrow(
    'Disable branch isolation',
  );
  expect(runner.release).toHaveBeenCalled();
});

it('locks every business table and assigns only unclassified records', async () => {
  const { service, query } = fixture();
  query.mockImplementation(async (sql) => [
    { count: sql.includes('WITH assigned AS') ? '7' : '0' },
  ]);
  await expect(service.prepare(workspaceId, branchId)).resolves.toEqual({
    objectsPrepared: 0,
    recordsAssigned: 7,
  });
  expect(query).toHaveBeenCalledWith(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`workspace-branch:${workspaceId}`],
  );
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('IN SHARE ROW EXCLUSIVE MODE'),
  );
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('WHERE "branchId" IS NULL RETURNING id'),
    [branchId],
  );
});

it('releases the preparation lock after metadata migration failure', async () => {
  const { service, setFields, createManyFields, runner } = fixture();
  setFields([]);
  createManyFields.mockRejectedValue(new Error('Migration failed'));
  await expect(service.prepare(workspaceId)).rejects.toThrow(
    'Migration failed',
  );
  expect(runner.query).toHaveBeenLastCalledWith(
    'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
    [`workspace-branch-prepare:${workspaceId}`],
  );
  expect(runner.release).toHaveBeenCalled();
});

it('rejects a concurrent preparation immediately instead of occupying pool connections waiting for its lock', async () => {
  const { service, createManyFields, runner } = fixture();
  runner.query.mockResolvedValue([{ locked: false }]);
  await expect(service.prepare(workspaceId)).rejects.toThrow('already running');
  expect(createManyFields).not.toHaveBeenCalled();
  expect(runner.query).toHaveBeenCalledTimes(1);
  expect(runner.release).toHaveBeenCalled();
});
