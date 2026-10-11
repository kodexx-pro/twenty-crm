import { ForbiddenException } from '@nestjs/common';
import { type ObjectRecordNonDestructiveEvent } from 'twenty-shared/database-events';

import { type WorkspaceBranchPrincipalAuthService } from 'src/engine/core-modules/workspace-branch/workspace-branch-principal-auth.service';
import { workspaceBranchAuditProofStorage } from 'src/engine/core-modules/workspace-branch/storage/workspace-branch-audit-proof.storage';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { UpsertTimelineActivityFromInternalEvent } from 'src/modules/timeline/jobs/upsert-timeline-activity-from-internal-event.job';
import { type TimelineActivityService } from 'src/modules/timeline/services/timeline-activity.service';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const recordId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const memberId = '44444444-4444-4444-8444-444444444444';
const batch = {
  workspaceId,
  name: 'person.updated',
  objectMetadata: { nameSingular: 'person' },
  branchPrincipal: { type: 'workspaceMember', id: memberId },
  events: [
    {
      recordId,
      properties: {
        before: { branchId },
        after: { branchId },
        updatedFields: ['name'],
        diff: {},
      },
    },
  ],
} as WorkspaceEventBatch<ObjectRecordNonDestructiveEvent>;

describe('branch-aware timeline job', () => {
  const upsertEvents = jest.fn();
  const hydrate = jest.fn();
  const executeInWorkspaceContext = jest.fn(
    async (callback: () => Promise<void>, _authContext?: WorkspaceAuthContext) => callback(),
  );
  const job = new UpsertTimelineActivityFromInternalEvent(
    { upsertEvents } as unknown as TimelineActivityService,
    { executeInWorkspaceContext } as unknown as WorkspaceOrmManager,
    { hydrate } as unknown as WorkspaceBranchPrincipalAuthService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    hydrate.mockResolvedValue({
      type: 'user',
      workspace: { id: workspaceId },
      workspaceMemberId: memberId,
    });
    upsertEvents.mockResolvedValue(undefined);
  });

  it('runs business reads as the freshly hydrated actor and scopes audit proofs to server snapshots', async () => {
    const captured: { current: ReturnType<typeof workspaceBranchAuditProofStorage.getStore> } = { current: undefined };
    upsertEvents.mockImplementationOnce(async () => {
      captured.current = workspaceBranchAuditProofStorage.getStore();
    });
    await job.handle(batch);
    expect(executeInWorkspaceContext.mock.calls[0][1]).toMatchObject({
      type: 'user',
      workspaceMemberId: memberId,
    });
    expect(captured.current?.proofs).toEqual([
      { objectName: 'person', recordId, branchId, operation: 'update' },
    ]);
    expect(captured.current?.authContext.type).toBe('user');
    expect(workspaceBranchAuditProofStorage.getStore()).toBeUndefined();
  });

  it('does not execute a queued event after the original actor is revoked', async () => {
    hydrate.mockRejectedValueOnce(new ForbiddenException('Removed member'));
    await expect(job.handle(batch)).rejects.toThrow('Removed member');
    expect(executeInWorkspaceContext).not.toHaveBeenCalled();
    expect(upsertEvents).not.toHaveBeenCalled();
  });

  it('retains the restricting application identity during hydration', async () => {
    await job.handle({ ...batch, branchApplicationId: recordId });
    expect(hydrate).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: recordId,
        principal: batch.branchPrincipal,
      }),
    );
  });
});
