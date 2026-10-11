import { type WorkspaceBranchOperation } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';

// Captured from server database events for derived audit writes only. This
// structure is never accepted as a user-supplied authorization credential.
export type WorkspaceBranchAuditProof = {
  objectName: string;
  recordId: string;
  branchId: string;
  operation: Exclude<WorkspaceBranchOperation, 'read' | 'transfer'>;
};
