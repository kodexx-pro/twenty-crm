import { AsyncLocalStorage } from 'node:async_hooks';

import { type WorkspaceBranchAuditProof } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-audit-proof.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

// Written only by authenticated server event jobs, never by request middleware.
export const workspaceBranchAuditProofStorage = new AsyncLocalStorage<{
  workspaceId: string;
  proofs: WorkspaceBranchAuditProof[];
  authContext: WorkspaceAuthContext;
}>();
