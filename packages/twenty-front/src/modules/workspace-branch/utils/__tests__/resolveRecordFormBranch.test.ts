import { resolveRecordFormBranch } from '@/workspace-branch/utils/resolveRecordFormBranch';
import { type WorkspaceBranch } from '@/workspace-branch/types/WorkspaceBranch';

const branch = (
  id: string,
  operations: WorkspaceBranch['operations'] = ['read', 'create'],
): WorkspaceBranch => ({ id, name: id, isActive: true, operations });
const branches = [branch('north'), branch('south')];

it('adds no branch choice when isolation is disabled', () => {
  expect(
    resolveRecordFormBranch({
      enabled: false,
      mode: 'create',
      branches,
      selectedBranchId: 'north',
    }),
  ).toBeNull();
});
it('requires a concrete branch when reading all permitted branches', () => {
  expect(
    resolveRecordFormBranch({
      enabled: true,
      mode: 'create',
      branches,
      selectedBranchId: 'all',
    }),
  ).toBeNull();
});
it('automatically chooses the only branch where creation is permitted', () => {
  expect(
    resolveRecordFormBranch({
      enabled: true,
      mode: 'create',
      branches: [branch('north', ['read']), branch('south')],
    }),
  ).toBe('south');
});
it('uses a selected permitted branch for new records', () => {
  expect(
    resolveRecordFormBranch({
      enabled: true,
      mode: 'create',
      branches,
      selectedBranchId: 'north',
    }),
  ).toBe('north');
});
it('does not let a saved forbidden branch become the record owner', () => {
  expect(
    resolveRecordFormBranch({
      enabled: true,
      mode: 'create',
      branches,
      selectedBranchId: 'other',
    }),
  ).toBeNull();
});
it('does not grant creation through read access or an inactive branch', () => {
  expect(
    resolveRecordFormBranch({
      enabled: true,
      mode: 'create',
      branches: [
        branch('north', ['read']),
        { ...branch('south'), isActive: false },
      ],
      selectedBranchId: 'south',
    }),
  ).toBeNull();
});
it('preserves the existing record branch when editing from a different scope', () => {
  expect(
    resolveRecordFormBranch({
      enabled: true,
      mode: 'edit',
      existingBranchId: 'north',
      selectedBranchId: 'south',
      branches,
    }),
  ).toBe('north');
});
it('does not assign the current branch to an unclassified existing record', () => {
  expect(
    resolveRecordFormBranch({
      enabled: true,
      mode: 'edit',
      selectedBranchId: 'south',
      branches,
    }),
  ).toBeNull();
});
