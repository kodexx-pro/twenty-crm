import { type RecordGqlOperationFilter } from 'twenty-shared/types';

import { type WorkspaceBranchAccess } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';

export const buildWorkspaceBranchRecordFilter = ({
  branchAccess,
  branchFieldName,
}: {
  branchAccess: WorkspaceBranchAccess;
  branchFieldName: string;
}): RecordGqlOperationFilter | null => {
  if (branchAccess.kind === 'unrestricted') {
    return null;
  }

  // Explicit false also handles an unassigned actor without a broad empty filter.
  if (branchAccess.branchIds.length === 0) {
    return { id: { is: 'NULL' } };
  }

  return { [branchFieldName]: { in: branchAccess.branchIds } };
};

export const intersectWorkspaceBranchRecordFilter = ({
  recordFilter,
  branchFilter,
}: {
  recordFilter: RecordGqlOperationFilter | null;
  branchFilter: RecordGqlOperationFilter | null;
}): RecordGqlOperationFilter | null => {
  if (branchFilter === null) {
    return recordFilter;
  }

  if (recordFilter === null) {
    return branchFilter;
  }

  return { and: [recordFilter, branchFilter] };
};
