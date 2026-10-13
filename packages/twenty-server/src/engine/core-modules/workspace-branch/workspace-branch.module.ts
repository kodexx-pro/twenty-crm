import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { KeyValuePairEntity } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { WorkspaceBranchResolver } from 'src/engine/core-modules/workspace-branch/workspace-branch.resolver';
import { WorkspaceBranchService } from 'src/engine/core-modules/workspace-branch/workspace-branch.service';
import { WorkspaceBranchProvisioningService } from 'src/engine/core-modules/workspace-branch/workspace-branch-provisioning.service';
import { WORKSPACE_BRANCH_ACTIVATION_VALIDATOR } from 'src/engine/core-modules/workspace-branch/workspace-branch.constants';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { IndexMetadataModule } from 'src/engine/metadata-modules/index-metadata/index-metadata.module';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { WorkspaceBranchToolService } from 'src/engine/core-modules/workspace-branch/tools/workspace-branch-tool.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([KeyValuePairEntity]),
    PermissionsModule,
    FieldMetadataModule,
    IndexMetadataModule,
  ],
  providers: [
    WorkspaceBranchService,
    WorkspaceBranchResolver,
    WorkspaceBranchProvisioningService,
    WorkspaceBranchToolService,
    {
      provide: WORKSPACE_BRANCH_ACTIVATION_VALIDATOR,
      useExisting: WorkspaceBranchProvisioningService,
    },
  ],
  exports: [WorkspaceBranchService, WorkspaceBranchToolService],
})
export class WorkspaceBranchModule {}
