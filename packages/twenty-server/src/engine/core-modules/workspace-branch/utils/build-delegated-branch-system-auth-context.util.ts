import { workspaceAuthContextStorage } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type WorkspaceBranchPrincipal } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { getWorkspaceContext } from 'src/engine/twenty-orm/storage/orm-workspace-context.storage';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export const captureWorkspaceBranchDelegation = (workspaceId: string): {
  principal?: WorkspaceBranchPrincipal;
  selectedBranchId?: string;
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

  return { principal, selectedBranchId: context.selectedBranchId };
};

export const buildDelegatedBranchSystemAuthContext = (
  workspaceId: string,
  delegation = captureWorkspaceBranchDelegation(workspaceId),
) => ({
  ...buildSystemAuthContext(workspaceId),
  delegatedBranchPrincipal: delegation.principal,
  selectedBranchId: delegation.selectedBranchId,
});
