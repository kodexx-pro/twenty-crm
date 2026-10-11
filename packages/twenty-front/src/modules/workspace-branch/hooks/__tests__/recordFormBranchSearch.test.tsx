import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { useObjectRecordSearchRecords } from '@/object-record/hooks/useObjectRecordSearchRecords';
import { RecordFormBranchContext } from '@/workspace-branch/contexts/RecordFormBranchContext';

const mockQuery = jest.fn();
let mockScope = { enabled: false, branchId: null as string | null };
let mockLoading = false;

jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: () => ({ id: 'member' }),
}));
jest.mock('@/object-metadata/hooks/useDoObjectMetadataItemsExist', () => ({
  useDoObjectMetadataItemsExist: () => true,
}));
jest.mock('@/object-metadata/hooks/useApolloCoreClient', () => ({
  useApolloCoreClient: () => ({}),
}));
jest.mock('@apollo/client/react', () => ({
  useQuery: (_document: unknown, options: unknown) => {
    mockQuery(options);
    return {
      loading: mockLoading,
      data: undefined,
      previousData: {
        search: { edges: [{ node: { recordId: 'other-branch-record' } }] },
      },
    };
  },
}));

const Wrapper = ({ children }: { children: ReactNode }) => (
  <RecordFormBranchContext.Provider value={mockScope}>
    {children}
  </RecordFormBranchContext.Provider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockScope = { enabled: false, branchId: null };
  mockLoading = false;
});

it('uses the form branch for relation and employee search without writing its results into the global query cache', () => {
  mockScope = { enabled: true, branchId: 'south' };
  renderHook(
    () =>
      useObjectRecordSearchRecords({
        objectNameSingulars: ['person', 'workspaceMember'],
        searchInput: '',
        fetchPolicy: 'cache-and-network',
      }),
    { wrapper: Wrapper },
  );
  expect(mockQuery).toHaveBeenCalledWith(
    expect.objectContaining({
      skip: false,
      fetchPolicy: 'no-cache',
      context: { headers: { 'x-workspace-branch-id': 'south' } },
    }),
  );
});

it('does not search all branches while the form has no concrete branch', () => {
  mockScope = { enabled: true, branchId: null };
  renderHook(
    () =>
      useObjectRecordSearchRecords({
        objectNameSingulars: ['person'],
        searchInput: '',
      }),
    { wrapper: Wrapper },
  );
  expect(mockQuery).toHaveBeenCalledWith(
    expect.objectContaining({ skip: true }),
  );
});

it('hides previous branch search results while loading the next branch', () => {
  mockScope = { enabled: true, branchId: 'south' };
  mockLoading = true;
  const { result } = renderHook(
    () =>
      useObjectRecordSearchRecords({
        objectNameSingulars: ['person'],
        searchInput: '',
      }),
    { wrapper: Wrapper },
  );
  expect(result.current.searchRecords).toEqual([]);
});

it('preserves normal search behavior when isolation is disabled', () => {
  mockLoading = true;
  const { result } = renderHook(
    () =>
      useObjectRecordSearchRecords({
        objectNameSingulars: ['person'],
        searchInput: '',
        fetchPolicy: 'cache-and-network',
      }),
    { wrapper: Wrapper },
  );
  expect(mockQuery).toHaveBeenCalledWith(
    expect.objectContaining({
      fetchPolicy: 'cache-and-network',
      context: undefined,
      skip: false,
    }),
  );
  expect(result.current.searchRecords).toEqual([
    { recordId: 'other-branch-record' },
  ]);
});
