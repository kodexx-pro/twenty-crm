import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { workspaceAuthContextStorage } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import {
  buildDelegatedBranchSystemAuthContext,
  captureWorkspaceBranchDelegation,
} from 'src/engine/core-modules/workspace-branch/utils/build-delegated-branch-system-auth-context.util';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';

describe('branch system delegation', () => {
  it('does not grant an anonymous job an implicit principal', () => {
    expect(captureWorkspaceBranchDelegation(workspaceId)).toEqual({});
    expect(buildDelegatedBranchSystemAuthContext(workspaceId).delegatedBranchPrincipal).toBeUndefined();
  });

  it('captures only the authenticated actor identity and selected branch', () => {
    const context = { type: 'user', workspace: { id: workspaceId }, workspaceMemberId: memberId, selectedBranchId: branchId } as WorkspaceAuthContext;

    workspaceAuthContextStorage.run(context, () => {
      expect(captureWorkspaceBranchDelegation(workspaceId)).toEqual({ principal: { type: 'workspaceMember', id: memberId }, selectedBranchId: branchId });
      const delegated = buildDelegatedBranchSystemAuthContext(workspaceId);
      expect(delegated.type).toBe('system');
      expect(delegated.delegatedBranchPrincipal).toEqual({ type: 'workspaceMember', id: memberId });
      expect(delegated).not.toHaveProperty('user');
    });
  });

  it('does not copy an actor across workspace boundaries', () => {
    const context = { type: 'user', workspace: { id: workspaceId }, workspaceMemberId: memberId } as WorkspaceAuthContext;

    workspaceAuthContextStorage.run(context, () => {
      expect(captureWorkspaceBranchDelegation(branchId)).toEqual({});
    });
  });

  it('preserves trusted delegation through nested system jobs', () => {
    const context = buildDelegatedBranchSystemAuthContext(workspaceId, { principal: { type: 'workspaceMember', id: memberId }, selectedBranchId: branchId });

    workspaceAuthContextStorage.run(context, () => {
      expect(buildDelegatedBranchSystemAuthContext(workspaceId)).toEqual(context);
    });
  });
});
