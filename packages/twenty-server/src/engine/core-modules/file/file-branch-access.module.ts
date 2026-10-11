import { Module } from '@nestjs/common';

import { FileBranchAccessService } from 'src/engine/core-modules/file/services/file-branch-access.service';

@Module({
  providers: [FileBranchAccessService],
  exports: [FileBranchAccessService],
})
export class FileBranchAccessModule {}
