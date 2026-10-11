import { workspaceAuthContextStorage } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type WorkspaceBranchPrincipal } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { getWorkspaceContext } from 'src/engine/twenty-orm/storage/orm-workspace-context.storage';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { workspaceBranchAuditProofStorage } from 'src/engine/core-modules/workspace-branch/storage/workspace-branch-audit-proof.storage';

export const captureWorkspaceBranchDelegation = (
  workspaceId: string,
): {
  principal?: WorkspaceBranchPrincipal;
  selectedBranchId?: string;
  applicationId?: string;
} => {
  let context: WorkspaceAuthContext | undefined;

  try {
    context = getWorkspaceContext().authContext;
  } catch {
    context = workspaceAuthContextStorage.getStore();
  }

  if (context?.workspace.id !== workspaceId) {
    return {};
  }

  const principal: WorkspaceBranchPrincipal | undefined =
    context.type === 'user'
      ? { type: 'workspaceMember', id: context.workspaceMemberId }
      : context.type === 'apiKey'
        ? { type: 'apiKey', id: context.apiKey.id }
        : context.type === 'application'
          ? { type: 'application', id: context.application.id }
          : context.type === 'system'
            ? context.delegatedBranchPrincipal
            : undefined;

  return {
    principal,
    selectedBranchId: context.selectedBranchId,
    ...(context.type === 'user' && context.application
      ? { applicationId: context.application.id }
      : {}),
  };
};

export const buildDelegatedBranchSystemAuthContext = (
  workspaceId: string,
  delegation = captureWorkspaceBranchDelegation(workspaceId),
) => {
  const audit = workspaceBranchAuditProofStorage.getStore();

  return {
    ...buildSystemAuthContext(workspaceId),
    delegatedBranchPrincipal: delegation.principal,
    selectedBranchId: delegation.selectedBranchId,
    ...(audit?.workspaceId === workspaceId
      ? { workspaceBranchAuditProofs: audit.proofs }
      : {}),
  };
};
