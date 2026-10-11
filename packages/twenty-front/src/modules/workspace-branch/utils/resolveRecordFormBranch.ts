import { type WorkspaceBranch } from '@/workspace-branch/types/WorkspaceBranch';

export const resolveRecordFormBranch = ({
  enabled,
  mode,
  existingBranchId,
  selectedBranchId,
  branches,
}: {
  enabled: boolean;
  mode: 'create' | 'edit';
  existingBranchId?: unknown;
  selectedBranchId?: string | null;
  branches: WorkspaceBranch[];
}): string | null => {
  if (!enabled) return null;
  if (mode === 'edit')
    return typeof existingBranchId === 'string' ? existingBranchId : null;
  const creatable = branches.filter(
    (branch) => branch.isActive && branch.operations?.includes('create'),
  );
  if (
    selectedBranchId &&
    creatable.some((branch) => branch.id === selectedBranchId)
  )
    return selectedBranchId;
  return creatable.length === 1 ? creatable[0].id : null;
};
