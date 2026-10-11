export const WORKSPACE_BRANCH_CONFIGURATION_KEY = 'workspace-branch-access';

export const WORKSPACE_BRANCH_ACTIVATION_VALIDATOR = Symbol(
  'WORKSPACE_BRANCH_ACTIVATION_VALIDATOR',
);

export const WORKSPACE_BRANCH_OPERATIONS = [
  'read',
  'create',
  'update',
  'delete',
  'restore',
  'transfer',
] as const;
