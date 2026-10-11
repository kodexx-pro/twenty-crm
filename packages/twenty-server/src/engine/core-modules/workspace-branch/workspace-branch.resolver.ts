import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { PrepareWorkspaceBranchesDTO } from 'src/engine/core-modules/workspace-branch/dtos/prepare-workspace-branches.dto';
import { WorkspaceBranchProvisioningService } from 'src/engine/core-modules/workspace-branch/workspace-branch-provisioning.service';
import { PermissionFlagType } from 'twenty-shared/constants';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import {
  MyWorkspaceBranchesDTO,
  UpdateWorkspaceBranchAccessInput,
  WorkspaceBranchAccessDTO,
} from 'src/engine/core-modules/workspace-branch/dtos/workspace-branch.dto';
import { WorkspaceBranchService } from 'src/engine/core-modules/workspace-branch/workspace-branch.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspaceMemberId } from 'src/engine/decorators/auth/auth-workspace-member-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthPrincipalGuard } from 'src/engine/guards/auth-principal.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';

@MetadataResolver(() => WorkspaceBranchAccessDTO)
@UsePipes(ResolverValidationPipe)
@UseFilters(AuthGraphqlApiExceptionFilter, PermissionsGraphqlApiExceptionFilter)
@UseGuards(
  AuthPrincipalGuard({
    userSession: {
      standard: true,
      impersonated: true,
      playground: true,
      workspaceAgnostic: false,
    },
    apiKey: false,
    oauthClient: false,
    application: false,
  }),
)
export class WorkspaceBranchResolver {
  constructor(
    private readonly service: WorkspaceBranchService,
    private readonly provisioningService: WorkspaceBranchProvisioningService,
  ) {}

  @Mutation(() => PrepareWorkspaceBranchesDTO)
  @UseGuards(SettingsPermissionGuard(PermissionFlagType.ROLES))
  prepareWorkspaceBranches(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('branchId', { type: () => UUIDScalarType, nullable: true })
    branchId?: string,
  ) {
    return this.provisioningService.prepare(workspace.id, branchId);
  }

  @Query(() => WorkspaceBranchAccessDTO)
  @UseGuards(SettingsPermissionGuard(PermissionFlagType.ROLES))
  async workspaceBranchAccess(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.service.toDTO(
      await this.service.getConfiguration(workspace.id),
    );
  }

  @Query(() => MyWorkspaceBranchesDTO)
  @UseGuards(NoPermissionGuard)
  myWorkspaceBranches(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId?: string,
  ) {
    return this.service.getMyBranches(
      workspace.id,
      workspaceMemberId
        ? { type: 'workspaceMember', id: workspaceMemberId }
        : undefined,
    );
  }

  @Mutation(() => WorkspaceBranchAccessDTO)
  @UseGuards(SettingsPermissionGuard(PermissionFlagType.ROLES))
  updateWorkspaceBranchAccess(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: UpdateWorkspaceBranchAccessInput,
  ) {
    return this.service.update(workspace.id, input);
  }
}
