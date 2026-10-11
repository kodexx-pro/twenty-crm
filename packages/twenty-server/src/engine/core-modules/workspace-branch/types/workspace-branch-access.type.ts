export type WorkspaceBranchOperation =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'transfer';

export type WorkspaceBranchPrincipal = {
  type: 'workspaceMember' | 'apiKey' | 'application';
  id: string;
};

export type WorkspaceBranch = {
  id: string;
  workspaceId: string;
  name: string;
  isActive: boolean;
};

export type WorkspaceBranchGrant = {
  principal: WorkspaceBranchPrincipal;
  branchId: string;
  operations: WorkspaceBranchOperation[];
};

export type WorkspaceBranchAccessConfiguration = {
  workspaceId: string;
  enabled: boolean;
  revision: number;
  branches: WorkspaceBranch[];
  grants: WorkspaceBranchGrant[];
};

export type WorkspaceBranchAccess =
  | { kind: 'unrestricted' }
  | { kind: 'restricted'; branchIds: string[]; fieldName?: 'branchId' | 'id' };
