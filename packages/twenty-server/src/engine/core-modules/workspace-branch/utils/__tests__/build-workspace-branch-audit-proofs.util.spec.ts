import { type ObjectRecordBaseEvent } from 'twenty-shared/database-events';

import { buildWorkspaceBranchAuditProofs } from 'src/engine/core-modules/workspace-branch/utils/build-workspace-branch-audit-proofs.util';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';

const branchId = '11111111-1111-4111-8111-111111111111';
const recordId = '22222222-2222-4222-8222-222222222222';

describe('server event audit proofs', () => {
  const batch = (
    name: string,
    properties: ObjectRecordBaseEvent['properties'],
  ) =>
    ({
      name,
      objectMetadata: { nameSingular: 'person' },
      events: [{ recordId, properties }],
    }) as WorkspaceEventBatch<ObjectRecordBaseEvent>;

  it('captures the source record branch and original operation', () => {
    expect(
      buildWorkspaceBranchAuditProofs(
        batch('person.updated', { after: { branchId } }),
      ),
    ).toEqual([
      { objectName: 'person', recordId, branchId, operation: 'update' },
    ]);
  });

  it('uses the trusted before snapshot for destroyed records', () => {
    expect(
      buildWorkspaceBranchAuditProofs(
        batch('person.destroyed', { before: { branchId } }),
      ),
    ).toEqual([
      { objectName: 'person', recordId, branchId, operation: 'delete' },
    ]);
  });

  it('does not derive proof from a selected branch or a malformed record', () => {
    expect(
      buildWorkspaceBranchAuditProofs(batch('person.updated', { after: {} })),
    ).toEqual([]);
    expect(
      buildWorkspaceBranchAuditProofs(
        batch('person.read', { after: { branchId } }),
      ),
    ).toEqual([]);
  });
});
