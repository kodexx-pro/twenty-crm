import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { useDirectFileUpload } from '@/file/hooks/useDirectFileUpload';
import { RecordFormBranchContext } from '@/workspace-branch/contexts/RecordFormBranchContext';
import { FileFolder } from '~/generated-metadata/graphql';

const mockCreate = jest.fn();
const mockComplete = jest.fn();
const mockPut = jest.fn();
let mockScope = { enabled: false, branchId: null as string | null };

jest.mock('@/file/utils/putFileToUploadTarget', () => ({
  putFileToUploadTarget: (...args: unknown[]) => mockPut(...args),
}));
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({}),
  useMutation: (document: { definitions: { name?: { value: string } }[] }) => [
    document.definitions[0]?.name?.value === 'CreateFileUpload'
      ? mockCreate
      : mockComplete,
  ],
}));

const Wrapper = ({ children }: { children: ReactNode }) => (
  <RecordFormBranchContext.Provider value={mockScope}>
    {children}
  </RecordFormBranchContext.Provider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockScope = { enabled: true, branchId: 'south' };
  mockCreate.mockResolvedValue({
    data: {
      createFileUpload: {
        fileId: 'file',
        uploadUrl: '/upload',
        contentType: 'text/plain',
      },
    },
  });
  mockComplete.mockResolvedValue({
    data: { completeFileUpload: { id: 'file' } },
  });
  mockPut.mockResolvedValue(undefined);
});

it('uploads into the concrete form branch even when the navigation has another scope', async () => {
  const { result } = renderHook(() => useDirectFileUpload(), {
    wrapper: Wrapper,
  });
  await act(async () => {
    await result.current.uploadFile(new File(['body'], 'test.txt'), {
      fileFolder: FileFolder.FilesField,
    });
  });
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      context: { headers: { 'x-workspace-branch-id': 'south' } },
    }),
  );
  expect(mockComplete).toHaveBeenCalledWith(
    expect.objectContaining({
      context: {
        headers: { 'x-workspace-branch-id': 'south' },
        fetchOptions: { signal: undefined },
      },
    }),
  );
});

it('does not start an upload while an isolated form has no branch', async () => {
  mockScope = { enabled: true, branchId: null };
  const { result } = renderHook(() => useDirectFileUpload(), {
    wrapper: Wrapper,
  });
  await expect(
    result.current.uploadFile(new File(['body'], 'test.txt'), {
      fileFolder: FileFolder.FilesField,
    }),
  ).rejects.toThrow('Select a branch');
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockPut).not.toHaveBeenCalled();
});

it('keeps ordinary uploads unchanged when branch isolation is disabled', async () => {
  mockScope = { enabled: false, branchId: null };
  const { result } = renderHook(() => useDirectFileUpload(), {
    wrapper: Wrapper,
  });
  await act(async () => {
    await result.current.uploadFile(new File(['body'], 'test.txt'), {
      fileFolder: FileFolder.FilesField,
    });
  });
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({ context: { headers: {} } }),
  );
});
