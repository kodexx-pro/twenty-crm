import { Module } from '@nestjs/common';

import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { FileBranchAccessModule } from 'src/engine/core-modules/file/file-branch-access.module';

import { FileUrlService } from './file-url.service';

@Module({
  imports: [JwtModule, FileBranchAccessModule],
  providers: [FileUrlService],
  exports: [FileUrlService],
})
export class FileUrlModule {}
