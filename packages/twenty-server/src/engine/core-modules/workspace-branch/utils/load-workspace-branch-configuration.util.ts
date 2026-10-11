import { ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { type DataSource, IsNull } from 'typeorm';

import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { WorkspaceBranchService } from 'src/engine/core-modules/workspace-branch/workspace-branch.service';
import { WORKSPACE_BRANCH_CONFIGURATION_KEY } from 'src/engine/core-modules/workspace-branch/workspace-branch.constants';

export const loadWorkspaceBranchConfiguration = async (
  coreDataSource: DataSource,
  workspaceId: string,
) => {
  if (!isUUID(workspaceId)) {
    throw new ForbiddenException('Invalid workspace context');
  }

  const entry = await coreDataSource.getRepository(KeyValuePairEntity).findOne({
    where: {
      workspaceId,
      userId: IsNull(),
      applicationId: IsNull(),
      key: WORKSPACE_BRANCH_CONFIGURATION_KEY,
      type: KeyValuePairType.CONFIG_VARIABLE,
    },
  });

  return WorkspaceBranchService.decode(workspaceId, entry);
};
