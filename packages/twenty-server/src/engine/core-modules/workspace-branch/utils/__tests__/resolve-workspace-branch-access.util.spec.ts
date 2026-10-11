import {
  type WorkspaceBranchAccessConfiguration,
  type WorkspaceBranchPrincipal,
} from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { resolveWorkspaceBranchAccess } from 'src/engine/core-modules/workspace-branch/utils/resolve-workspace-branch-access.util';

describe('workspace branch access', () => {
  const principal: WorkspaceBranchPrincipal = {
    type: 'workspaceMember',
    id: 'member-one',
  };
  const configuration: WorkspaceBranchAccessConfiguration = {
    workspaceId: 'workspace-one',
    enabled: true,
    revision: 1,
    branches: [
      {
        id: 'north',
        workspaceId: 'workspace-one',
        name: 'North',
        isActive: true,
      },
      {
        id: 'south',
        workspaceId: 'workspace-one',
        name: 'South',
        isActive: false,
      },
      {
        id: 'other',
        workspaceId: 'workspace-two',
        name: 'Other',
        isActive: true,
      },
    ],
    grants: [
      { principal, branchId: 'north', operations: ['read', 'create'] },
      { principal, branchId: 'north', operations: ['read'] },
      { principal, branchId: 'south', operations: ['read', 'create'] },
      { principal, branchId: 'other', operations: ['read', 'create'] },
      { principal, branchId: 'missing', operations: ['read', 'create'] },
      {
        principal: { type: 'apiKey', id: principal.id },
        branchId: 'north',
        operations: ['delete'],
      },
    ],
  };

  const resolve = (operation: 'read' | 'create' | 'delete') =>
    resolveWorkspaceBranchAccess({
      configuration,
      workspaceId: 'workspace-one',
      principal,
      operation,
    });

  it('leaves the existing access unchanged when isolation is disabled', () => {
    expect(
      resolveWorkspaceBranchAccess({
        configuration: { ...configuration, enabled: false },
        workspaceId: 'workspace-one',
        operation: 'read',
      }),
    ).toEqual({ kind: 'unrestricted' });
  });

  it('never accepts configuration from another workspace, even if disabled', () => {
    expect(
      resolveWorkspaceBranchAccess({
        configuration: { ...configuration, enabled: false },
        workspaceId: 'workspace-two',
        principal,
        operation: 'read',
      }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
  });

  it('keeps authorized inactive history readable and removes duplicates', () => {
    expect(resolve('read')).toEqual({
      kind: 'restricted',
      branchIds: ['north', 'south'],
    });
  });

  it('only creates records in active authorized branches of the same workspace', () => {
    expect(resolve('create')).toEqual({
      kind: 'restricted',
      branchIds: ['north'],
    });
  });

  it('does not confuse a service identity with a member sharing the same ID', () => {
    expect(resolve('delete')).toEqual({ kind: 'restricted', branchIds: [] });
  });

  it('denies system and unassigned identities when isolation is active', () => {
    expect(
      resolveWorkspaceBranchAccess({
        configuration,
        workspaceId: 'workspace-one',
        operation: 'read',
      }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
    expect(
      resolveWorkspaceBranchAccess({
        configuration,
        workspaceId: 'workspace-one',
        principal: { type: 'workspaceMember', id: 'unassigned' },
        operation: 'read',
      }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
  });

  it('uses the new grants after access has been revoked', () => {
    expect(
      resolveWorkspaceBranchAccess({
        configuration: { ...configuration, revision: 2, grants: [] },
        workspaceId: 'workspace-one',
        principal,
        operation: 'read',
      }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
  });
});
