import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { MY_WORKSPACE_BRANCHES } from '@/workspace-branch/graphql/workspaceBranchAccess';
import { type WorkspaceBranchAccess } from '@/workspace-branch/types/WorkspaceBranch';
import { readWorkspaceBranchSelection } from '@/workspace-branch/utils/workspaceBranchSelection';
import { useQuery } from '@apollo/client/react';

export const useWorkspaceBranches = () => {
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const { data, loading, error } = useQuery<{
    myWorkspaceBranches: Pick<
      WorkspaceBranchAccess,
      'enabled' | 'revision' | 'branches'
    >;
  }>(MY_WORKSPACE_BRANCHES, {
    skip: !currentWorkspace,
    fetchPolicy: 'network-only',
  });
  const branches =
    data?.myWorkspaceBranches.branches.filter((branch) => branch.isActive) ??
    [];
  const savedSelection = readWorkspaceBranchSelection(currentWorkspace?.id);
  const selectedBranchId =
    branches.length === 1
      ? branches[0].id
      : branches.some((branch) => branch.id === savedSelection)
        ? savedSelection
        : 'all';

  return {
    workspaceId: currentWorkspace?.id,
    enabled: data?.myWorkspaceBranches.enabled === true,
    branches,
    selectedBranchId,
    loading,
    error,
  };
};
