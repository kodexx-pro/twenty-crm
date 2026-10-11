import {
  readWorkspaceBranchSelection,
  writeWorkspaceBranchSelection,
} from '@/workspace-branch/utils/workspaceBranchSelection';

beforeEach(() => localStorage.clear());

it('keeps branch preferences separate for each workspace', () => {
  writeWorkspaceBranchSelection('company-a', 'north');
  writeWorkspaceBranchSelection('company-b', 'south');
  expect(readWorkspaceBranchSelection('company-a')).toBe('north');
  expect(readWorkspaceBranchSelection('company-b')).toBe('south');
});
it('does not reuse another workspace preference when signing out', () => {
  writeWorkspaceBranchSelection('company-a', 'north');
  expect(readWorkspaceBranchSelection()).toBeNull();
  expect(readWorkspaceBranchSelection('company-c')).toBeNull();
});
