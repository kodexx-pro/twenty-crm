import { Module } from '@nestjs/common';

import { UpsertTimelineActivityFromInternalEvent } from 'src/modules/timeline/jobs/upsert-timeline-activity-from-internal-event.job';
import { TimelineActivityModule } from 'src/modules/timeline/timeline-activity.module';
import { WorkspaceBranchPrincipalAuthService } from 'src/engine/core-modules/workspace-branch/workspace-branch-principal-auth.service';

@Module({
  imports: [TimelineActivityModule],
  providers: [
    UpsertTimelineActivityFromInternalEvent,
    WorkspaceBranchPrincipalAuthService,
  ],
})
export class TimelineJobModule {}
