import { isUUID } from 'class-validator';
import { type ObjectRecordBaseEvent } from 'twenty-shared/database-events';

import { type WorkspaceBranchAuditProof } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-audit-proof.type';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';

export const buildWorkspaceBranchAuditProofs = (
  batch: WorkspaceEventBatch<ObjectRecordBaseEvent>,
): WorkspaceBranchAuditProof[] => {
  const action = batch.name.split('.').at(-1);

  return batch.events.flatMap((event) => {
    const snapshot =
      action === 'deleted' || action === 'destroyed'
        ? event.properties.before
        : event.properties.after;

    if (
      !snapshot ||
      !('branchId' in snapshot) ||
      typeof snapshot.branchId !== 'string' ||
      !isUUID(snapshot.branchId) ||
      !isUUID(event.recordId)
    ) {
      return [];
    }

    let operation: WorkspaceBranchAuditProof['operation'];

    if (action === 'created') {
      operation = 'create';
    } else if (action === 'updated') {
      operation = 'update';
    } else if (action === 'deleted' || action === 'destroyed') {
      operation = 'delete';
    } else if (action === 'restored') {
      operation = 'restore';
    } else if (action === 'upserted') {
      operation = event.properties.before ? 'update' : 'create';
    } else {
      return [];
    }

    return [
      {
        objectName: batch.objectMetadata.nameSingular,
        recordId: event.recordId,
        branchId: snapshot.branchId,
        operation,
      },
    ];
  });
};
