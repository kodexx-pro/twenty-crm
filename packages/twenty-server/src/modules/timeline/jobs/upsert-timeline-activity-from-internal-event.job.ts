import { type ObjectRecordNonDestructiveEvent } from 'twenty-shared/database-events';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { WorkspaceBranchPrincipalAuthService } from 'src/engine/core-modules/workspace-branch/workspace-branch-principal-auth.service';
import { workspaceBranchAuditProofStorage } from 'src/engine/core-modules/workspace-branch/storage/workspace-branch-audit-proof.storage';
import { buildWorkspaceBranchAuditProofs } from 'src/engine/core-modules/workspace-branch/utils/build-workspace-branch-audit-proofs.util';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { TimelineActivityService } from 'src/modules/timeline/services/timeline-activity.service';

@Processor(MessageQueue.entityEventsToDbQueue)
export class UpsertTimelineActivityFromInternalEvent {
  constructor(
    private readonly timelineActivityService: TimelineActivityService,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly branchPrincipalAuthService: WorkspaceBranchPrincipalAuthService,
  ) {}

  @Process(UpsertTimelineActivityFromInternalEvent.name)
  async handle(
    workspaceEventBatch: WorkspaceEventBatch<ObjectRecordNonDestructiveEvent>,
  ): Promise<void> {
    if (workspaceEventBatch.events.length === 0) {
      return;
    }

    const authContext = await this.branchPrincipalAuthService.hydrate({
      workspaceId: workspaceEventBatch.workspaceId,
      principal: workspaceEventBatch.branchPrincipal,
      selectedBranchId: workspaceEventBatch.selectedBranchId,
      applicationId: workspaceEventBatch.branchApplicationId,
    });

    await workspaceBranchAuditProofStorage.run(
      {
        workspaceId: workspaceEventBatch.workspaceId,
        proofs: buildWorkspaceBranchAuditProofs(workspaceEventBatch),
        authContext,
      },
      () =>
        this.workspaceOrmManager.executeInWorkspaceContext(
          async () =>
            await this.timelineActivityService.upsertEvents(
              workspaceEventBatch,
            ),
          authContext,
        ),
    );
  }
}
