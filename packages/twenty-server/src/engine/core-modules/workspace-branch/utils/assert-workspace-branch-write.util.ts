import { ForbiddenException } from '@nestjs/common';
import { isNonEmptyString } from '@sniptt/guards';

import { type WorkspaceBranchAccess } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';

const assertAllowedBranch = (
  branchAccess: WorkspaceBranchAccess,
  branchId: unknown,
): void => {
  if (branchAccess.kind === 'unrestricted') {
    return;
  }

  if (
    !isNonEmptyString(branchId) ||
    !branchAccess.branchIds.includes(branchId)
  ) {
    throw new ForbiddenException('Branch access denied');
  }
};

export const assertWorkspaceBranchWrite = ({
  operationAccess,
  branchIdBefore,
  branchIdAfter,
  isCreation,
  transferAccess,
  destinationCreationAccess,
}: {
  operationAccess: WorkspaceBranchAccess;
  branchIdBefore?: unknown;
  branchIdAfter: unknown;
  isCreation: boolean;
  transferAccess?: WorkspaceBranchAccess;
  destinationCreationAccess?: WorkspaceBranchAccess;
}): void => {
  if (operationAccess.kind === 'unrestricted') {
    return;
  }

  if (isCreation) {
    assertAllowedBranch(operationAccess, branchIdAfter);

    return;
  }

  assertAllowedBranch(operationAccess, branchIdBefore);

  if (branchIdBefore === branchIdAfter) {
    return;
  }

  if (
    transferAccess?.kind !== 'restricted' ||
    destinationCreationAccess?.kind !== 'restricted'
  ) {
    throw new ForbiddenException('Branch transfer access denied');
  }

  assertAllowedBranch(transferAccess, branchIdBefore);
  assertAllowedBranch(transferAccess, branchIdAfter);
  assertAllowedBranch(destinationCreationAccess, branchIdAfter);
};
