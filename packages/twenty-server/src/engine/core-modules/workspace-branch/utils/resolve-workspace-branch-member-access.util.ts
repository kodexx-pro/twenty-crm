import { type WorkspaceBranchAccess, type WorkspaceBranchAccessConfiguration, type WorkspaceBranchPrincipal } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { resolveWorkspaceBranchAccess } from 'src/engine/core-modules/workspace-branch/utils/resolve-workspace-branch-access.util';

export const resolveWorkspaceBranchMemberAccess = ({configuration,workspaceId,principal,selectedBranchId}: {
  configuration: WorkspaceBranchAccessConfiguration;
  workspaceId: string;
  principal?: WorkspaceBranchPrincipal;
  selectedBranchId?: string;
}): WorkspaceBranchAccess => {
  const access = resolveWorkspaceBranchAccess({configuration,workspaceId,principal,operation: 'read'});
  if (access.kind === 'unrestricted') return access;
  const branches = new Set(access.branchIds.filter(id => !selectedBranchId || id === selectedBranchId));
  const members = new Set(configuration.grants.filter(grant =>
    grant.principal.type === 'workspaceMember' && branches.has(grant.branchId) && grant.operations.length > 0,
  ).map(grant => grant.principal.id));
  if (configuration.workspaceId === workspaceId && principal?.type === 'workspaceMember') members.add(principal.id);
  return {kind: 'restricted', branchIds: [...members], fieldName: 'id'};
};
