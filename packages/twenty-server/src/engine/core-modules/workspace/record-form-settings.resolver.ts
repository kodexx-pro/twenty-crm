import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';
import { PermissionFlagType } from 'twenty-shared/constants';
import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import {
  RecordFormSettingsDTO,
  UpdateRecordFormSettingsInput,
} from 'src/engine/core-modules/workspace/dtos/record-form-settings.dto';
import { RecordFormSettingsService } from 'src/engine/core-modules/workspace/services/record-form-settings.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthPrincipalGuard } from 'src/engine/guards/auth-principal.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';

@MetadataResolver(() => RecordFormSettingsDTO)
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
export class RecordFormSettingsResolver {
  constructor(private readonly service: RecordFormSettingsService) {}

  @Query(() => RecordFormSettingsDTO)
  @UseGuards(NoPermissionGuard)
  recordFormSettings(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('objectMetadataId', { type: () => UUIDScalarType, nullable: true })
    objectMetadataId?: string,
  ) {
    return this.service.find(workspace.id, objectMetadataId);
  }

  @Mutation(() => RecordFormSettingsDTO)
  @UseGuards(SettingsPermissionGuard(PermissionFlagType.LAYOUTS))
  updateRecordFormSettings(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: UpdateRecordFormSettingsInput,
  ) {
    return this.service.update(workspace.id, input);
  }
}
