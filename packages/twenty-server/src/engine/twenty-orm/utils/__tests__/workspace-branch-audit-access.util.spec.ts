import { type WorkspaceBranchAccessConfiguration } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { type WorkspaceBranchAuditProof } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-audit-proof.type';
import { resolveWorkspaceBranchAuditAccess } from 'src/engine/twenty-orm/utils/resolve-workspace-branch-audit-access.util';

const configuration: WorkspaceBranchAccessConfiguration = {
  workspaceId: 'workspace',
  enabled: true,
  revision: 1,
  branches: [
    { id: 'branch-a', workspaceId: 'workspace', name: 'A', isActive: true },
  ],
  grants: [
    {
      principal: { type: 'workspaceMember', id: 'member' },
      branchId: 'branch-a',
      operations: ['update'],
    },
  ],
};
const proof: WorkspaceBranchAuditProof = {
  objectName: 'company',
  recordId: 'company-a',
  branchId: 'branch-a',
  operation: 'update',
};
const args = {
  configuration,
  workspaceId: 'workspace',
  principal: { type: 'workspaceMember' as const, id: 'member' },
  proofs: [proof],
};
const record = {
  objectSingularName: 'company',
  recordId: 'company-a',
  branchId: 'branch-a',
};

describe('derived branch audit authorization', () => {
  it('allows a captured update audit without requiring generic record creation', () => {
    expect(resolveWorkspaceBranchAuditAccess({ ...args, record })).toEqual({
      kind: 'restricted',
      branchIds: ['branch-a'],
    });
  });
  it.each([
    { ...record, recordId: 'other-company' },
    { ...record, objectSingularName: 'person' },
    { ...record, branchId: 'branch-b' },
  ])('rejects source-record or branch substitutions (%j)', (changed) => {
    expect(
      resolveWorkspaceBranchAuditAccess({ ...args, record: changed }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
  });
  it('does not authorize unproved writes even for an otherwise granted branch', () => {
    expect(
      resolveWorkspaceBranchAuditAccess({ ...args, proofs: [], record }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
  });
  it('does not convert an update grant into a proof of creation', () => {
    expect(
      resolveWorkspaceBranchAuditAccess({
        ...args,
        proofs: [{ ...proof, operation: 'create' }],
        record,
      }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
  });
  it('respects revocation and tenant separation', () => {
    expect(
      resolveWorkspaceBranchAuditAccess({
        ...args,
        configuration: { ...configuration, grants: [] },
        record,
      }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
    expect(
      resolveWorkspaceBranchAuditAccess({
        ...args,
        workspaceId: 'other-workspace',
        record,
      }),
    ).toEqual({ kind: 'restricted', branchIds: [] });
  });
});
