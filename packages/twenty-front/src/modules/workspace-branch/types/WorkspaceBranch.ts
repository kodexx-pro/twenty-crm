export type WorkspaceBranchOperation =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'transfer';

export type WorkspaceBranch = {
  id: string;
  name: string;
  isActive: boolean;
  operations?: WorkspaceBranchOperation[];
};

export type WorkspaceBranchGrant = {
  principalType: 'workspaceMember' | 'apiKey' | 'application';
  principalId: string;
  branchId: string;
  operations: WorkspaceBranchOperation[];
};

export type WorkspaceBranchAccess = {
  enabled: boolean;
  revision: number;
  branches: WorkspaceBranch[];
  grants: WorkspaceBranchGrant[];
};
