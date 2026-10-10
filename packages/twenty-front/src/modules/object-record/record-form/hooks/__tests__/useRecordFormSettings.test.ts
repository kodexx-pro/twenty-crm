import { useRecordFormSettings } from '@/object-record/record-form/hooks/useRecordFormSettings';
import { renderHook } from '@testing-library/react';

const mockUpdateSettings = jest.fn();
const mockRefetch = jest.fn();
let mockSettings:
  | {
      workspace: { presentation: string | null };
      object: { presentation: string | null };
    }
  | undefined;

jest.mock('@apollo/client/react', () => ({
  useQuery: () => ({
    data: mockSettings,
    loading: false,
    refetch: mockRefetch,
  }),
  useMutation: () => [mockUpdateSettings],
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = undefined;
  mockRefetch.mockResolvedValue({ data: mockSettings });
});

it('keeps side panels as the default until settings are loaded', () => {
  expect(
    renderHook(() => useRecordFormSettings('object-a')).result.current
      .presentation,
  ).toBe('SIDE_PANEL');
});

it('inherits the workspace preference and lets an object override it', () => {
  mockSettings = {
    workspace: { presentation: 'DIALOG' },
    object: { presentation: null },
  };
  const { result, rerender } = renderHook(() =>
    useRecordFormSettings('object-a'),
  );
  expect(result.current.presentation).toBe('DIALOG');
  mockSettings.object.presentation = 'SIDE_PANEL';
  rerender();
  expect(result.current.presentation).toBe('SIDE_PANEL');
});

it('scopes object and workspace writes separately and refreshes settings', async () => {
  const { result } = renderHook(() => useRecordFormSettings('object-a'));
  await result.current.saveSettings({ presentation: 'DIALOG' });
  expect(mockUpdateSettings).toHaveBeenCalledWith({
    variables: {
      input: { objectMetadataId: 'object-a', presentation: 'DIALOG' },
    },
  });
  await result.current.saveSettings({ presentation: 'SIDE_PANEL' }, true);
  expect(mockUpdateSettings).toHaveBeenLastCalledWith({
    variables: {
      input: { objectMetadataId: null, presentation: 'SIDE_PANEL' },
    },
  });
  expect(mockRefetch).toHaveBeenCalledTimes(2);
});

it('does not refresh or swallow a rejected settings write', async () => {
  mockUpdateSettings.mockRejectedValueOnce(new Error('Forbidden'));
  const { result } = renderHook(() => useRecordFormSettings('object-a'));
  await expect(
    result.current.saveSettings({ presentation: 'DIALOG' }),
  ).rejects.toThrow('Forbidden');
  expect(mockRefetch).not.toHaveBeenCalled();
});
