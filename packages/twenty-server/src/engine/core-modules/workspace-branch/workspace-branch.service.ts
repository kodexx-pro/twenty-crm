import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { isUUID, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import {
  type MyWorkspaceBranchesDTO,
  type WorkspaceBranchAccessDTO,
  UpdateWorkspaceBranchAccessInput,
} from 'src/engine/core-modules/workspace-branch/dtos/workspace-branch.dto';
import {
  type WorkspaceBranchAccessConfiguration,
  type WorkspaceBranchPrincipal,
} from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { resolveWorkspaceBranchAccess } from 'src/engine/core-modules/workspace-branch/utils/resolve-workspace-branch-access.util';
import {
  WORKSPACE_BRANCH_ACTIVATION_VALIDATOR,
  WORKSPACE_BRANCH_CONFIGURATION_KEY,
  WORKSPACE_BRANCH_OPERATIONS,
} from 'src/engine/core-modules/workspace-branch/workspace-branch.constants';

export type WorkspaceBranchActivationValidator = {
  validateActivation: (
    workspaceId: string,
    configuration: WorkspaceBranchAccessConfiguration,
  ) => Promise<void>;
  validatePrincipals: (
    workspaceId: string,
    principals: WorkspaceBranchPrincipal[],
  ) => Promise<void>;
};

@Injectable()
export class WorkspaceBranchService {
  constructor(
    @InjectRepository(KeyValuePairEntity)
    private readonly repository: Repository<KeyValuePairEntity>,
    @Optional()
    @Inject(WORKSPACE_BRANCH_ACTIVATION_VALIDATOR)
    private readonly activationValidator?: WorkspaceBranchActivationValidator,
  ) {}

  private where(workspaceId: string) {
    if (!isUUID(workspaceId)) {
      throw new ForbiddenException('Invalid workspace context');
    }

    return {
      workspaceId,
      userId: IsNull(),
      applicationId: IsNull(),
      key: WORKSPACE_BRANCH_CONFIGURATION_KEY,
      type: KeyValuePairType.CONFIG_VARIABLE,
    };
  }

  static decode(
    workspaceId: string,
    entry: KeyValuePairEntity | null,
  ): WorkspaceBranchAccessConfiguration {
    if (!entry) {
      return {
        workspaceId,
        enabled: false,
        revision: 0,
        branches: [],
        grants: [],
      };
    }

    const configuration =
      entry.value as unknown as WorkspaceBranchAccessConfiguration;

    // Corrupt stored policies must never silently disable authorization.
    if (!configuration || configuration.workspaceId !== workspaceId) {
      throw new ForbiddenException('Invalid branch configuration');
    }

    const input = plainToInstance(UpdateWorkspaceBranchAccessInput, {
      expectedRevision: configuration.revision,
      enabled: configuration.enabled,
      branches: configuration.branches,
      grants: configuration.grants?.map((grant) => ({
        principalType: grant.principal?.type,
        principalId: grant.principal?.id,
        branchId: grant.branchId,
        operations: grant.operations,
      })),
    });

    if (validateSync(input).length > 0) {
      throw new ForbiddenException('Invalid branch configuration');
    }

    WorkspaceBranchService.validateReferences(input);

    if (
      configuration.branches.some(
        (branch) => branch.workspaceId !== workspaceId,
      )
    ) {
      throw new ForbiddenException('Invalid branch configuration');
    }

    return configuration;
  }

  async getConfiguration(
    workspaceId: string,
  ): Promise<WorkspaceBranchAccessConfiguration> {
    return WorkspaceBranchService.decode(
      workspaceId,
      await this.repository.findOne({ where: this.where(workspaceId) }),
    );
  }

  private static validateReferences(input: UpdateWorkspaceBranchAccessInput) {
    const ids = new Set(input.branches.map((branch) => branch.id));

    if (ids.size !== input.branches.length) {
      throw new BadRequestException('Branch identifiers must be unique');
    }

    const keys = input.grants.map(
      (grant) =>
        `${grant.principalType}:${grant.principalId}:${grant.branchId}`,
    );

    if (
      new Set(keys).size !== keys.length ||
      input.grants.some((grant) => !ids.has(grant.branchId))
    ) {
      throw new BadRequestException('Invalid branch grants');
    }

    if (input.enabled && !input.branches.some((branch) => branch.isActive)) {
      throw new BadRequestException('At least one active branch is required');
    }
  }

  toDTO(
    configuration: WorkspaceBranchAccessConfiguration,
  ): WorkspaceBranchAccessDTO {
    return {
      enabled: configuration.enabled,
      revision: configuration.revision,
      branches: configuration.branches,
      grants: configuration.grants.map((grant) => ({
        principalType: grant.principal.type,
        principalId: grant.principal.id,
        branchId: grant.branchId,
        operations: grant.operations,
      })),
    };
  }

  async getMyBranches(
    workspaceId: string,
    principal?: WorkspaceBranchPrincipal,
  ): Promise<MyWorkspaceBranchesDTO> {
    const configuration = await this.getConfiguration(workspaceId);

    return {
      enabled: configuration.enabled,
      revision: configuration.revision,
      branches: configuration.enabled
        ? configuration.branches.flatMap((branch) => {
            const operations = WORKSPACE_BRANCH_OPERATIONS.filter(
              (operation) => {
                const access = resolveWorkspaceBranchAccess({
                  configuration,
                  workspaceId,
                  principal,
                  operation,
                });

                return (
                  access.kind === 'restricted' &&
                  access.branchIds.includes(branch.id)
                );
              },
            );

            return operations.length ? [{ ...branch, operations }] : [];
          })
        : [],
    };
  }

  async update(
    workspaceId: string,
    input: UpdateWorkspaceBranchAccessInput,
  ): Promise<WorkspaceBranchAccessDTO> {
    this.where(workspaceId);

    if (
      validateSync(plainToInstance(UpdateWorkspaceBranchAccessInput, input))
        .length
    ) {
      throw new BadRequestException('Invalid branch settings');
    }

    WorkspaceBranchService.validateReferences(input);

    return this.repository.manager.transaction(async (manager) => {
      // Serialize even the first insertion, when no row exists to lock yet.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`workspace-branch:${workspaceId}`],
      );
      const repository = manager.getRepository(KeyValuePairEntity);
      const previous = WorkspaceBranchService.decode(
        workspaceId,
        await repository.findOne({ where: this.where(workspaceId) }),
      );

      if (previous.revision !== input.expectedRevision) {
        throw new ConflictException(
          'Branch settings changed; reload before saving',
        );
      }

      if (
        previous.enabled &&
        previous.branches.some(
          (branch) =>
            !input.branches.some((candidate) => candidate.id === branch.id),
        )
      ) {
        throw new BadRequestException(
          'Existing branches must be deactivated, not removed',
        );
      }

      const configuration: WorkspaceBranchAccessConfiguration = {
        workspaceId,
        enabled: input.enabled,
        revision: previous.revision + 1,
        branches: input.branches.map((branch) => ({
          id: branch.id,
          name: branch.name.trim(),
          isActive: branch.isActive,
          workspaceId,
        })),
        grants: input.grants.map((grant) => ({
          principal: { type: grant.principalType, id: grant.principalId },
          branchId: grant.branchId,
          operations: grant.operations,
        })),
      };

      if (configuration.grants.length) {
        if (!this.activationValidator) {
          throw new BadRequestException(
            'Branch principal validation is not ready',
          );
        }

        await this.activationValidator.validatePrincipals(
          workspaceId,
          configuration.grants.map((grant) => grant.principal),
        );
      }

      if (configuration.enabled) {
        if (!this.activationValidator) {
          throw new BadRequestException(
            'Branch isolation is not ready for activation',
          );
        }

        await this.activationValidator.validateActivation(
          workspaceId,
          configuration,
        );
      }

      await repository.upsert(
        {
          workspaceId,
          userId: null,
          applicationId: null,
          key: WORKSPACE_BRANCH_CONFIGURATION_KEY,
          type: KeyValuePairType.CONFIG_VARIABLE,
          value: configuration as unknown as JSON,
        },
        {
          conflictPaths: ['key', 'workspaceId'],
          indexPredicate: '"userId" IS NULL AND "applicationId" IS NULL',
        },
      );

      return this.toDTO(configuration);
    });
  }
}
