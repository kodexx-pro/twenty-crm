import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { FieldMetadataType, IndexType } from 'twenty-shared/types';
import { DataSource, IsNull } from 'typeorm';

import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import {
  type WorkspaceBranchAccessConfiguration,
  type WorkspaceBranchPrincipal,
} from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { shouldIsolateWorkspaceObject } from 'src/engine/core-modules/workspace-branch/utils/should-isolate-workspace-object.util';
import { WORKSPACE_BRANCH_CONFIGURATION_KEY } from 'src/engine/core-modules/workspace-branch/workspace-branch.constants';
import {
  WorkspaceBranchService,
  type WorkspaceBranchActivationValidator,
} from 'src/engine/core-modules/workspace-branch/workspace-branch.service';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { RelationType } from 'src/engine/metadata-modules/field-metadata/interfaces/relation-type.interface';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { IndexMetadataEntity } from 'src/engine/metadata-modules/index-metadata/index-metadata.entity';
import { IndexMetadataService } from 'src/engine/metadata-modules/index-metadata/services/index-metadata.service';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

const quoteIdentifier = (identifier: string) =>
  `"${identifier.replace(/"/g, '""')}"`;

@Injectable()
export class WorkspaceBranchProvisioningService implements WorkspaceBranchActivationValidator {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly indexMetadataService: IndexMetadataService,
  ) {}

  private async objects(workspaceId: string) {
    if (!isUUID(workspaceId))
      throw new BadRequestException('Invalid workspace');
    return (
      await this.dataSource
        .getRepository(ObjectMetadataEntity)
        .find({ where: { workspaceId } })
    ).filter(shouldIsolateWorkspaceObject);
  }

  async validatePrincipals(
    workspaceId: string,
    principals: WorkspaceBranchPrincipal[],
  ) {
    const schema = quoteIdentifier(getWorkspaceSchemaName(workspaceId));
    for (const principal of principals) {
      if (!isUUID(principal.id))
        throw new BadRequestException('Invalid branch principal');
      const rows: { id: string }[] =
        principal.type === 'workspaceMember'
          ? await this.dataSource.query(
              `SELECT id FROM ${schema}."workspaceMember" WHERE id = $1 AND "deletedAt" IS NULL`,
              [principal.id],
            )
          : principal.type === 'apiKey'
            ? await this.dataSource.query(
                'SELECT id FROM core."apiKey" WHERE id = $1 AND "workspaceId" = $2 AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > NOW())',
                [principal.id, workspaceId],
              )
            : await this.dataSource.query(
                'SELECT id FROM core."application" WHERE id = $1 AND "workspaceId" = $2 AND "deletedAt" IS NULL',
                [principal.id, workspaceId],
              );
      if (rows.length !== 1)
        throw new BadRequestException(
          'Branch principal does not belong to this workspace or is inactive',
        );
    }
  }

  async validateActivation(
    workspaceId: string,
    configuration: WorkspaceBranchAccessConfiguration,
  ) {
    const objects = await this.objects(workspaceId);
    const fields = await this.dataSource
      .getRepository(FieldMetadataEntity)
      .find({ where: { workspaceId } });
    const schema = quoteIdentifier(getWorkspaceSchemaName(workspaceId));
    const branchIds = configuration.branches.map((branch) => branch.id);
    if (branchIds.length === 0)
      throw new BadRequestException('Add a branch before enabling isolation');
    for (const object of objects) {
      const field = fields.find(
        (candidate) =>
          candidate.objectMetadataId === object.id &&
          candidate.name === 'branchId',
      );
      if (
        object.isRemote ||
        !field ||
        field.type !== FieldMetadataType.UUID ||
        !field.isSystem ||
        !field.isActive ||
        field.isUIEditable
      ) {
        throw new BadRequestException(
          `Prepare branch ownership for ${object.labelPlural} before enabling isolation`,
        );
      }
      const table = `${schema}.${quoteIdentifier(object.nameSingular)}`;
      const rows: { count: string }[] = await this.dataSource.query(
        `SELECT COUNT(*)::text AS count FROM ${table} WHERE "branchId" IS NULL OR NOT ("branchId" = ANY($1::uuid[]))`,
        [branchIds],
      );
      if (Number(rows[0]?.count ?? 0) > 0)
        throw new BadRequestException(
          `Assign all records in ${object.labelPlural} to a branch before enabling isolation`,
        );
    }
    await this.validateRelationships(
      workspaceId,
      objects,
      fields,
      configuration,
    );
    const invalidFiles: { count: string }[] = await this.dataSource.query(
      `SELECT COUNT(*)::text AS count FROM ${schema}."attachment" a
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a."file", '[]'::jsonb)) attached
       LEFT JOIN core."file" f ON f.id::text = attached->>'fileId' AND f."workspaceId" = $1
       WHERE a."deletedAt" IS NULL AND (f.id IS NULL OR f.settings->>'branchId' IS DISTINCT FROM a."branchId"::text)`,
      [workspaceId],
    );
    if (Number(invalidFiles[0]?.count ?? 0) > 0) {
      throw new BadRequestException(
        'Prepare attachment file ownership before enabling branch isolation',
      );
    }
  }

  private async validateRelationships(
    workspaceId: string,
    objects: ObjectMetadataEntity[],
    fields: FieldMetadataEntity[],
    configuration: WorkspaceBranchAccessConfiguration,
  ) {
    const schema = quoteIdentifier(getWorkspaceSchemaName(workspaceId));
    const allObjects = await this.dataSource
      .getRepository(ObjectMetadataEntity)
      .find({ where: { workspaceId } });
    const employeeGrants = configuration.grants
      .filter(
        (grant) =>
          grant.principal.type === 'workspaceMember' &&
          grant.operations.includes('read'),
      )
      .map((grant) => ({
        branchId: grant.branchId,
        memberId: grant.principal.id,
      }));
    for (const field of fields) {
      if (
        field.type !== FieldMetadataType.RELATION &&
        field.type !== FieldMetadataType.MORPH_RELATION
      )
        continue;
      const settings = field.settings as {
        relationType?: string;
        joinColumnName?: string;
      } | null;
      if (settings?.relationType === RelationType.ONE_TO_MANY) continue;
      const source = objects.find(
        (object) => object.id === field.objectMetadataId,
      );
      if (!source) continue;
      const target = allObjects.find(
        (object) => object.id === field.relationTargetObjectMetadataId,
      );
      if (
        settings?.relationType !== RelationType.MANY_TO_ONE ||
        !settings.joinColumnName ||
        !target ||
        target.isRemote ||
        (target.nameSingular !== 'workspaceMember' &&
          !shouldIsolateWorkspaceObject(target))
      ) {
        throw new BadRequestException(
          `Unsupported branch relationship ${source.labelPlural}.${field.label}`,
        );
      }
      const sourceTable = `${schema}.${quoteIdentifier(source.nameSingular)}`;
      const targetTable = `${schema}.${quoteIdentifier(target.nameSingular)}`;
      const joinColumn = quoteIdentifier(settings.joinColumnName);
      const employeeCondition = `target."deletedAt" IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM jsonb_to_recordset($1::jsonb) AS allowed("branchId" uuid, "memberId" uuid)
        WHERE allowed."branchId" = source."branchId" AND allowed."memberId" = target.id
      )`;
      const invalid: { count: string }[] = await this.dataSource.query(
        `SELECT COUNT(*)::text AS count FROM ${sourceTable} source
         LEFT JOIN ${targetTable} target ON target.id = source.${joinColumn}
         WHERE source.${joinColumn} IS NOT NULL AND (target.id IS NULL OR ${target.nameSingular === 'workspaceMember' ? employeeCondition : 'target."branchId" IS DISTINCT FROM source."branchId"'})`,
        target.nameSingular === 'workspaceMember'
          ? [JSON.stringify(employeeGrants)]
          : [],
      );
      if (Number(invalid[0]?.count ?? 0) > 0) {
        throw new BadRequestException(
          `Resolve cross-branch or unauthorized relationships in ${source.labelPlural}.${field.label} before enabling isolation`,
        );
      }
    }
  }

  async prepare(workspaceId: string, branchId?: string) {
    if (!isUUID(workspaceId))
      throw new BadRequestException('Invalid workspace');
    const runner = this.dataSource.createQueryRunner();
    const lockKey = `workspace-branch-prepare:${workspaceId}`;
    let locked = false;
    try {
      await runner.connect();
      // Metadata migrations use separate connections. A distinct session lock
      // serializes preparation without conflicting with the configuration lock.
      const locks: { locked: boolean }[] = await runner.query(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked',
        [lockKey],
      );
      locked = locks[0]?.locked === true;
      if (!locked)
        throw new ConflictException(
          'Branch preparation is already running. Try again after it completes.',
        );
      return await this.prepareUnlocked(workspaceId, branchId);
    } finally {
      try {
        if (locked)
          await runner.query(
            'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
            [lockKey],
          );
      } finally {
        await runner.release();
      }
    }
  }

  private async prepareUnlocked(workspaceId: string, branchId?: string) {
    const objects = await this.objects(workspaceId);
    if (objects.some((object) => object.isRemote))
      throw new BadRequestException(
        'Remote objects do not yet support branch isolation',
      );
    const existingFields = await this.dataSource
      .getRepository(FieldMetadataEntity)
      .find({ where: { workspaceId, name: 'branchId' } });
    for (const field of existingFields) {
      if (
        field.type !== FieldMetadataType.UUID ||
        !field.isSystem ||
        !field.isActive ||
        field.isUIEditable
      )
        throw new BadRequestException(
          'An existing branchId field conflicts with protected branch ownership',
        );
    }
    const missing = objects.filter(
      (object) =>
        !existingFields.some((field) => field.objectMetadataId === object.id),
    );
    await this.fieldMetadataService.createManyFields({
      workspaceId,
      isSystemBuild: true,
      createFieldInputs: missing.map((object) => ({
        objectMetadataId: object.id,
        type: FieldMetadataType.UUID,
        name: 'branchId',
        label: 'Filial',
        description: 'Protected branch ownership',
        icon: 'IconBuilding',
        isSystem: true,
        isActive: true,
        isUIEditable: false,
        isNullable: true,
        isUnique: false,
      })),
    });

    const preparedFields = await this.dataSource
      .getRepository(FieldMetadataEntity)
      .find({ where: { workspaceId, name: 'branchId' } });
    const indexes = await this.dataSource
      .getRepository(IndexMetadataEntity)
      .find({ where: { workspaceId }, relations: ['indexFieldMetadatas'] });
    for (const object of objects) {
      const field = preparedFields.find(
        (candidate) => candidate.objectMetadataId === object.id,
      );
      if (!field)
        throw new BadRequestException(
          'Protected branch metadata was not created',
        );
      const indexed = indexes.some(
        (index) =>
          index.objectMetadataId === object.id &&
          index.indexType === IndexType.BTREE &&
          index.indexFieldMetadatas.some(
            (indexField) =>
              indexField.fieldMetadataId === field.id && indexField.order === 0,
          ),
      );
      if (!indexed) {
        await this.indexMetadataService.createOne({
          workspaceId,
          createIndexInput: {
            objectMetadataId: object.id,
            fields: [{ fieldMetadataId: field.id }],
            indexType: IndexType.BTREE,
          },
        });
      }
    }

    const recordsAssigned = await this.dataSource.transaction(
      async (manager) => {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`workspace-branch:${workspaceId}`],
        );
        const entry = await manager.getRepository(KeyValuePairEntity).findOne({
          where: {
            workspaceId,
            key: WORKSPACE_BRANCH_CONFIGURATION_KEY,
            type: KeyValuePairType.CONFIG_VARIABLE,
            userId: IsNull(),
            applicationId: IsNull(),
          },
        });
        const configuration = WorkspaceBranchService.decode(workspaceId, entry);
        if (!branchId) return 0;
        if (configuration.enabled)
          throw new BadRequestException(
            'Disable branch isolation before assigning unclassified records',
          );
        if (
          !isUUID(branchId) ||
          !configuration.branches.some(
            (branch) => branch.id === branchId && branch.isActive,
          )
        )
          throw new BadRequestException('Select an active saved branch');
        const schema = quoteIdentifier(getWorkspaceSchemaName(workspaceId));
        // Lock every business table together so a concurrent writer cannot introduce
        // an unclassified relationship while existing records are being assigned.
        const tables = objects
          .map((object) => `${schema}.${quoteIdentifier(object.nameSingular)}`)
          .sort();
        if (tables.length)
          await manager.query(
            `LOCK TABLE ${tables.join(', ')} IN SHARE ROW EXCLUSIVE MODE`,
          );
        let assigned = 0;
        for (const table of tables) {
          const rows: { count: string }[] = await manager.query(
            `WITH assigned AS (UPDATE ${table} SET "branchId" = $1 WHERE "branchId" IS NULL RETURNING id) SELECT COUNT(*)::text AS count FROM assigned`,
            [branchId],
          );
          assigned += Number(rows[0]?.count ?? 0);
        }
        await manager.query(
          `WITH ownership AS (
          SELECT attached->>'fileId' AS id, MIN(a."branchId"::text) AS "branchId"
          FROM ${schema}."attachment" a
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a."file", '[]'::jsonb)) attached
          GROUP BY attached->>'fileId' HAVING COUNT(DISTINCT a."branchId") = 1
        ) UPDATE core."file" f SET settings = COALESCE(f.settings, '{}'::jsonb) || jsonb_build_object('branchId', ownership."branchId")
        FROM ownership WHERE f.id::text = ownership.id AND f."workspaceId" = $1 AND f.settings->>'branchId' IS NULL`,
          [workspaceId],
        );
        return assigned;
      },
    );
    return { objectsPrepared: missing.length, recordsAssigned };
  }
}
