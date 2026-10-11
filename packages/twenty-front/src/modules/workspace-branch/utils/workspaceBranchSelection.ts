const getStorageKey = (workspaceId: string) => `kodexx-branch:${workspaceId}`;

export const readWorkspaceBranchSelection = (
  workspaceId?: string,
): string | null => {
  if (!workspaceId || typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(getStorageKey(workspaceId));
  } catch {
    return null;
  }
};

export const writeWorkspaceBranchSelection = (
  workspaceId: string,
  branchId: string,
) => {
  try {
    localStorage.setItem(getStorageKey(workspaceId), branchId);
  } catch {
    throw new Error(
      'Unable to save the branch selection. Allow browser storage and try again.',
    );
  }
};

export const getWorkspaceBranchSelectionHeaders = (
  workspaceId?: string,
): Record<string, string> => {
  const branchId = readWorkspaceBranchSelection(workspaceId);
  return branchId && branchId !== 'all'
    ? { 'x-workspace-branch-id': branchId }
    : {};
};
