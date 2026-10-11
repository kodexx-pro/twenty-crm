import {
  readWorkspaceBranchSelection,
  writeWorkspaceBranchSelection,
  getWorkspaceBranchSelectionHeaders,
} from '@/workspace-branch/utils/workspaceBranchSelection';

beforeEach(() => localStorage.clear());

it('keeps branch preferences separate for each workspace', () => {
  writeWorkspaceBranchSelection('company-a', 'north');
  writeWorkspaceBranchSelection('company-b', 'south');
  expect(readWorkspaceBranchSelection('company-a')).toBe('north');
  expect(readWorkspaceBranchSelection('company-b')).toBe('south');
});

it('sends the selected concrete branch over independent SSE transports and omits all-permitted scope', () => {
  writeWorkspaceBranchSelection('company-a', 'north');
  expect(getWorkspaceBranchSelectionHeaders('company-a')).toEqual({
    'x-workspace-branch-id': 'north',
  });
  writeWorkspaceBranchSelection('company-a', 'all');
  expect(getWorkspaceBranchSelectionHeaders('company-a')).toEqual({});
  expect(getWorkspaceBranchSelectionHeaders('company-b')).toEqual({});
});
it('does not reuse another workspace preference when signing out', () => {
  writeWorkspaceBranchSelection('company-a', 'north');
  expect(readWorkspaceBranchSelection()).toBeNull();
  expect(readWorkspaceBranchSelection('company-c')).toBeNull();
});
