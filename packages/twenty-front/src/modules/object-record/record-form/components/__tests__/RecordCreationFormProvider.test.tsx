import { RecordCreationFormProvider } from '@/object-record/record-form/components/RecordCreationFormProvider';
import { useRecordCreationFormContextOrThrow } from '@/object-record/record-form/contexts/RecordCreationFormContext';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { isSidePanelOpenedState } from '@/side-panel/states/isSidePanelOpenedState';
import {
  sidePanelNavigationStackState,
  type SidePanelNavigationStackItem,
} from '@/side-panel/states/sidePanelNavigationStackState';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { act, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { type ReactNode } from 'react';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

const mockNavigateSidePanelMenu = jest.fn();
const mockCloseSidePanelMenu = jest.fn();
const mockOpenDialog = jest.fn();
const mockCloseDialog = jest.fn();

jest.mock('@/ui/layout/dialog/hooks/useDialog', () => ({
  useDialog: () => ({
    openDialog: mockOpenDialog,
    closeDialog: mockCloseDialog,
  }),
}));
jest.mock('@/object-record/record-form/components/RecordFormDialog', () => ({
  RecordFormDialog: ({
    onCancel,
    isSubmitting,
  }: {
    onCancel: () => void;
    isSubmitting: boolean;
  }) => (
    <button disabled={isSubmitting} onClick={onCancel}>
      Cancel record form
    </button>
  ),
}));

jest.mock('@/side-panel/hooks/useSidePanelMenu', () => ({
  useSidePanelMenu: () => ({
    navigateSidePanelMenu: mockNavigateSidePanelMenu,
    closeSidePanelMenu: mockCloseSidePanelMenu,
  }),
}));

const setup = () => {
  const store = createStore();
  mockNavigateSidePanelMenu.mockImplementation(
    (page: SidePanelNavigationStackItem) => {
      store.set(isSidePanelOpenedState.atom, true);
      store.set(sidePanelNavigationStackState.atom, [page]);
    },
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <RecordCreationFormProvider>{children}</RecordCreationFormProvider>
    </Provider>
  );
  return {
    ...renderHook(useRecordCreationFormContextOrThrow, { wrapper }),
    store,
  };
};

beforeEach(() => jest.clearAllMocks());

it('opens a centered dialog without navigating the side panel and resolves cancellation', async () => {
  const { result } = setup();
  const createRecord = jest.fn();
  let pending: Promise<ObjectRecord | null> | undefined;
  act(() => {
    pending = result.current.requestRecordCreation({
      objectMetadataItem: getMockObjectMetadataItemOrThrow('company'),
      createRecord,
      presentation: 'DIALOG',
    });
  });
  expect(mockNavigateSidePanelMenu).not.toHaveBeenCalled();
  expect(mockOpenDialog).toHaveBeenCalledTimes(1);
  await userEvent.click(
    screen.getByRole('button', { name: 'Cancel record form' }),
  );
  expect(await pending).toBeNull();
  expect(createRecord).not.toHaveBeenCalled();
  expect(mockCloseDialog).toHaveBeenCalled();
});

it('retains the dialog after a rejected submission and closes after retry succeeds', async () => {
  const { result } = setup();
  const createRecord = jest
    .fn()
    .mockRejectedValueOnce(new Error('Invalid draft'))
    .mockResolvedValueOnce({ id: 'created-company', __typename: 'Company' });
  let pending: Promise<ObjectRecord | null> | undefined;
  act(() => {
    pending = result.current.requestRecordCreation({
      objectMetadataItem: getMockObjectMetadataItemOrThrow('company'),
      createRecord,
      presentation: 'DIALOG',
    });
  });
  const requestId = mockOpenDialog.mock.calls[0][0];
  await act(async () => {
    await result.current.settleRecordCreationDraft({
      requestId,
      draftRecord: { name: 'Test' },
    });
  });
  expect(mockCloseDialog).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Cancel record form' }),
  ).toBeEnabled();
  await act(async () => {
    await result.current.settleRecordCreationDraft({
      requestId,
      draftRecord: { name: 'Test' },
    });
  });
  expect(await pending).toEqual({
    id: 'created-company',
    __typename: 'Company',
  });
  expect(mockCloseDialog).toHaveBeenCalledWith(requestId);
});

it('removes the form from deeper in the history when the user moved on before creation finished', async () => {
  const { result, store } = setup();
  let completeCreation: (record: ObjectRecord) => void = () => {};
  const createRecord = jest.fn(
    () =>
      new Promise<ObjectRecord>((resolve) => {
        completeCreation = resolve;
      }),
  );
  act(() => {
    void result.current.requestRecordCreation({
      objectMetadataItem: getMockObjectMetadataItemOrThrow('company'),
      createRecord,
    });
  });
  const [formPage] = store.get(sidePanelNavigationStackState.atom);
  let submission: Promise<unknown> | undefined;
  act(() => {
    submission = result.current.settleRecordCreationDraft({
      requestId: formPage.pageId,
      draftRecord: { name: 'Test' },
    });
  });
  await act(async () => {
    await result.current.settleRecordCreationDraft({
      requestId: formPage.pageId,
      draftRecord: { name: 'Test' },
    });
  });
  expect(createRecord).toHaveBeenCalledTimes(1);

  const otherPage = { ...formPage, pageId: 'other-page' };
  act(() => {
    store.set(sidePanelNavigationStackState.atom, [formPage, otherPage]);
  });
  await act(async () => {
    completeCreation({ id: 'created-company', __typename: 'Company' });
    await submission;
  });

  expect(mockCloseSidePanelMenu).not.toHaveBeenCalled();
  expect(store.get(sidePanelNavigationStackState.atom)).toEqual([otherPage]);
});

it('resolves with the error the server rejected the draft with and keeps the form open', async () => {
  const { result, store } = setup();
  const rejection = new CombinedGraphQLErrors({
    data: null,
    errors: [
      {
        message: 'A company needs an amount',
        extensions: {
          subCode: 'VALIDATION_RULE_VIOLATION',
          validationRuleViolations: [
            { ruleId: 'amount-rule', fieldMetadataId: 'field-amount' },
          ],
        },
      },
    ],
  });
  const createRecord = jest.fn(() => Promise.reject(rejection));
  act(() => {
    void result.current.requestRecordCreation({
      objectMetadataItem: getMockObjectMetadataItemOrThrow('company'),
      createRecord,
    });
  });
  const [formPage] = store.get(sidePanelNavigationStackState.atom);

  let settlement: unknown;
  await act(async () => {
    settlement = await result.current.settleRecordCreationDraft({
      requestId: formPage.pageId,
      draftRecord: { name: 'Test' },
    });
  });

  expect(createRecord).toHaveBeenCalledTimes(1);
  expect(createRecord).toHaveBeenCalledWith({ name: 'Test' });
  expect(settlement).toEqual({ error: rejection });
  expect(store.get(sidePanelNavigationStackState.atom)).toEqual([formPage]);
});
