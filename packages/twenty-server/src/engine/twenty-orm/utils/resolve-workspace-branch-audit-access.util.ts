import {
  type WorkspaceBranchAccess,
  type WorkspaceBranchAccessConfiguration,
  type WorkspaceBranchPrincipal,
} from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { type WorkspaceBranchAuditProof } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-audit-proof.type';
import { resolveWorkspaceBranchAccess } from 'src/engine/core-modules/workspace-branch/utils/resolve-workspace-branch-access.util';

export const resolveWorkspaceBranchAuditAccess = ({
  configuration,
  workspaceId,
  principal,
  proofs,
  record,
}: {
  configuration: WorkspaceBranchAccessConfiguration;
  workspaceId: string;
  principal?: WorkspaceBranchPrincipal;
  proofs: WorkspaceBranchAuditProof[];
  record?: Record<string, unknown>;
}): WorkspaceBranchAccess => {
  const branchIds = proofs
    .filter(
      (proof) =>
        !record ||
        (proof.objectName === record.objectSingularName &&
          proof.recordId === record.recordId &&
          proof.branchId === record.branchId),
    )
    .flatMap((proof) => {
      const access = resolveWorkspaceBranchAccess({
        configuration,
        workspaceId,
        principal,
        operation: proof.operation,
      });
      return access.kind === 'restricted' &&
        access.branchIds.includes(proof.branchId)
        ? [proof.branchId]
        : [];
    });
  return { kind: 'restricted', branchIds: [...new Set(branchIds)] };
};
