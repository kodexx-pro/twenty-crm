import { ForbiddenException } from '@nestjs/common';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type WorkspaceInternalContext } from 'src/engine/twenty-orm/interfaces/workspace-internal-context.interface';
import { type RolePermissionConfig } from 'src/engine/twenty-orm/types/role-permission-config.type';
import { resolveRolePermissionConfig } from 'src/engine/twenty-orm/utils/resolve-role-permission-config.util';

// Branch grants restrict records; they never replace the actor's object and field permissions.
export const normalizeWorkspaceBranchRolePermissionConfig = ({
  authContext,
  internalContext,
  rolePermissionConfig,
}: {
  authContext: WorkspaceAuthContext;
  internalContext: WorkspaceInternalContext;
  rolePermissionConfig?: RolePermissionConfig;
}): RolePermissionConfig | undefined => {
  if (
    !internalContext.workspaceBranchConfiguration?.enabled ||
    authContext.type === 'system'
  )
    return rolePermissionConfig;
  const actual = resolveRolePermissionConfig({
    authContext,
    userWorkspaceRoleMap: internalContext.userWorkspaceRoleMap,
    apiKeyRoleMap: internalContext.apiKeyRoleMap,
  });
  if (
    !actual ||
    !('intersectionOf' in actual) ||
    actual.intersectionOf.length === 0
  )
    throw new ForbiddenException('No role assigned to branch-scoped actor');
  if (
    !rolePermissionConfig ||
    'shouldBypassPermissionChecks' in rolePermissionConfig
  )
    return actual;
  const explicit =
    'intersectionOf' in rolePermissionConfig
      ? rolePermissionConfig.intersectionOf
      : rolePermissionConfig.unionOf;
  if (
    explicit.length === 0 ||
    ('unionOf' in rolePermissionConfig && explicit.length !== 1)
  )
    throw new ForbiddenException('Invalid branch-scoped role restriction');
  return {
    intersectionOf: [...new Set([...actual.intersectionOf, ...explicit])],
  };
};
