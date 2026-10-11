import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { ApiKeyEntity } from 'src/engine/core-modules/api-key/api-key.entity';
import { fromApiKeyEntityToFlat } from 'src/engine/core-modules/api-key/utils/from-api-key-entity-to-flat.util';
import { ApplicationEntity } from 'src/engine/core-modules/application/application.entity';
import { fromApplicationEntityToFlatApplication } from 'src/engine/core-modules/application/utils/from-application-entity-to-flat-application.util';
import { AUTH_CONTEXT_USER_SELECT_FIELDS } from 'src/engine/core-modules/auth/constants/auth-context-user-select-fields.constants';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { buildApiKeyAuthContext } from 'src/engine/core-modules/auth/utils/build-api-key-auth-context.util';
import { buildApplicationAuthContext } from 'src/engine/core-modules/auth/utils/build-application-auth-context.util';
import { buildUserAuthContext } from 'src/engine/core-modules/auth/utils/build-user-auth-context.util';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { fromUserEntityToFlat } from 'src/engine/core-modules/user/utils/from-user-entity-to-flat.util';
import { type WorkspaceBranchPrincipal } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { loadWorkspaceBranchConfiguration } from 'src/engine/core-modules/workspace-branch/utils/load-workspace-branch-configuration.util';
import { fromWorkspaceEntityToFlat } from 'src/engine/core-modules/workspace/utils/from-workspace-entity-to-flat.util';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

@Injectable()
export class WorkspaceBranchPrincipalAuthService {
  constructor(
    @InjectDataSource() private readonly coreDataSource: DataSource,
  ) {}

  async hydrate({
    workspaceId,
    principal,
    selectedBranchId,
    applicationId,
  }: {
    workspaceId: string;
    principal?: WorkspaceBranchPrincipal;
    selectedBranchId?: string;
    applicationId?: string;
  }): Promise<WorkspaceAuthContext> {
    const configuration = await loadWorkspaceBranchConfiguration(
      this.coreDataSource,
      workspaceId,
    );

    // Workspaces which have not opted in preserve their existing job flow.
    if (!configuration.enabled) {
      return buildSystemAuthContext(workspaceId);
    }

    if (
      !principal ||
      !isUUID(principal.id) ||
      (selectedBranchId && !isUUID(selectedBranchId))
    ) {
      throw new ForbiddenException(
        'A branch job requires an authenticated principal',
      );
    }

    const workspaceEntity = await this.coreDataSource
      .getRepository(WorkspaceEntity)
      .findOne({ where: { id: workspaceId } });

    if (
      !workspaceEntity ||
      workspaceEntity.deletedAt ||
      workspaceEntity.activationStatus !== WorkspaceActivationStatus.ACTIVE
    ) {
      throw new ForbiddenException('Workspace is unavailable');
    }

    const workspace = fromWorkspaceEntityToFlat(workspaceEntity);
    let context: WorkspaceAuthContext;

    if (principal.type === 'apiKey') {
      const apiKey = await this.coreDataSource
        .getRepository(ApiKeyEntity)
        .findOne({ where: { id: principal.id, workspaceId } });

      if (
        !apiKey ||
        apiKey.revokedAt ||
        !(apiKey.expiresAt.getTime() > Date.now())
      ) {
        throw new ForbiddenException('API key is no longer authorized');
      }

      context = buildApiKeyAuthContext({
        workspace,
        apiKey: fromApiKeyEntityToFlat(apiKey),
      });
    } else if (principal.type === 'application') {
      context = buildApplicationAuthContext({
        workspace,
        application: await this.findApplication(workspaceId, principal.id),
      });
    } else if (principal.type === 'workspaceMember') {
      const schema = getWorkspaceSchemaName(workspaceId);
      const members = await this.coreDataSource.query<
        WorkspaceMemberWorkspaceEntity[]
      >(
        `SELECT * FROM "${schema}"."workspaceMember" WHERE "id" = $1 AND "deletedAt" IS NULL`,
        [principal.id],
      );
      const workspaceMember = members[0];

      if (!workspaceMember || !isUUID(workspaceMember.userId)) {
        throw new ForbiddenException(
          'Workspace member is no longer authorized',
        );
      }

      const [userWorkspace, user] = await Promise.all([
        this.coreDataSource
          .getRepository(UserWorkspaceEntity)
          .findOne({ where: { workspaceId, userId: workspaceMember.userId } }),
        this.coreDataSource.getRepository(UserEntity).findOne({
          where: { id: workspaceMember.userId },
          select: [...AUTH_CONTEXT_USER_SELECT_FIELDS],
        }),
      ]);

      if (
        !userWorkspace ||
        userWorkspace.deletedAt ||
        !user ||
        user.deletedAt ||
        user.disabled
      ) {
        throw new ForbiddenException(
          'Workspace member is no longer authorized',
        );
      }

      context = buildUserAuthContext({
        workspace,
        userWorkspaceId: userWorkspace.id,
        user: fromUserEntityToFlat(user),
        workspaceMemberId: workspaceMember.id,
        workspaceMember,
        application: applicationId
          ? await this.findApplication(workspaceId, applicationId)
          : undefined,
      });
    } else {
      throw new ForbiddenException('Invalid branch principal');
    }

    return { ...context, selectedBranchId };
  }

  private async findApplication(workspaceId: string, applicationId: string) {
    if (!isUUID(applicationId)) {
      throw new ForbiddenException('Invalid application principal');
    }

    const application = await this.coreDataSource
      .getRepository(ApplicationEntity)
      .findOne({ where: { workspaceId, id: applicationId } });

    if (!application || application.deletedAt) {
      throw new ForbiddenException('Application is no longer installed');
    }

    return fromApplicationEntityToFlatApplication(application);
  }
}
