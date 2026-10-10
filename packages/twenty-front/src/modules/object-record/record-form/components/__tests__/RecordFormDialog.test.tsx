import { RecordFormDialog } from '@/object-record/record-form/components/RecordFormDialog';
import { useDialog } from '@/ui/layout/dialog/hooks/useDialog';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { type ReactNode } from 'react';

jest.mock(
  '@/side-panel/pages/record-creation-form/components/SidePanelRecordCreationFormPage',
  () => ({
    SidePanelRecordCreationFormPage: ({
      onCancel,
    }: {
      onCancel: () => void;
    }) => (
      <>
        <input aria-label="Name" />
        <button onClick={onCancel}>Cancel</button>
      </>
    ),
  }),
);
jest.mock(
  '@/side-panel/pages/record-creation-form-settings/components/SidePanelRecordCreationFormSettingsPage',
  () => ({
    SidePanelRecordCreationFormSettings: () => null,
  }),
);

const setup = (isSubmitting = false) => {
  const store = createStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </Provider>
  );
  const { result } = renderHook(useDialog, { wrapper });
  const onCancel = jest.fn();
  render(
    <RecordFormDialog
      requestId="test-form-dialog"
      isSubmitting={isSubmitting}
      onCancel={onCancel}
    />,
    { wrapper },
  );
  act(() => result.current.openDialog('test-form-dialog'));
  return { onCancel };
};

it('exposes an accessible dialog and dismisses it with Escape', async () => {
  const { onCancel } = setup();
  expect(
    screen.getByRole('dialog', { name: 'Record form' }),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Name'));
  await userEvent.keyboard('{Escape}');
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('prevents Escape and outside dismissal while submission is in progress', async () => {
  const { onCancel } = setup(true);
  await userEvent.click(screen.getByLabelText('Name'));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByTestId('dialog-viewport'));
  expect(onCancel).not.toHaveBeenCalled();
});
