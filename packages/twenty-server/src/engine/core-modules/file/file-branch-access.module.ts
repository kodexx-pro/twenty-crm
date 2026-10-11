import { Module } from '@nestjs/common';

import { FileBranchAccessService } from 'src/engine/core-modules/file/services/file-branch-access.service';
import { WorkspaceBranchPrincipalAuthService } from 'src/engine/core-modules/workspace-branch/workspace-branch-principal-auth.service';

@Module({
  providers: [FileBranchAccessService, WorkspaceBranchPrincipalAuthService],
  exports: [FileBranchAccessService],
})
export class FileBranchAccessModule {}
