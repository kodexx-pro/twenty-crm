import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type createElement } from 'react';

import { SettingsWorkspaceBranches } from '@/workspace-branch/components/SettingsWorkspaceBranches';
import { type WorkspaceBranchAccess } from '@/workspace-branch/types/WorkspaceBranch';
import { messages as brazilianPortugueseMessages } from '~/locales/generated/pt-BR';
import { messages as portugueseMessages } from '~/locales/generated/pt-PT';

let mockAllowed = true;
let mockAccess: WorkspaceBranchAccess;
const mockUpdate = jest.fn();
const mockPrepare = jest.fn();
const mockRefetch = jest.fn();
const mockQuery = jest.fn();

jest.mock('@/settings/roles/hooks/useHasPermissionFlag', () => ({
  useHasPermissionFlag: () => mockAllowed,
}));
jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: () => [],
}));
jest.mock('@apollo/client/react', () => ({
  useQuery: (_document: unknown, options: unknown) => {
    mockQuery(options);
    return {
      data: { workspaceBranchAccess: mockAccess },
      loading: false,
      refetch: mockRefetch,
    };
  },
  useMutation: (document: { definitions: { name?: { value: string } }[] }) => [
    document.definitions[0].name?.value === 'PrepareWorkspaceBranches'
      ? mockPrepare
      : mockUpdate,
    { loading: false },
  ],
}));
jest.mock('@/ui/input/components/SettingsTextInput', () => {
  const React = require('react') as { createElement: typeof createElement };
  return {
    SettingsTextInput: ({
      label,
      value,
      onChange,
    }: {
      label: string;
      value: string;
      onChange: (value: string) => void;
    }) =>
      React.createElement('input', {
        'aria-label': label,
        value,
        onChange: (event: { target: { value: string } }) =>
          onChange(event.target.value),
      }),
  };
});
jest.mock('@/ui/input/components/Select', () => {
  const React = require('react') as { createElement: typeof createElement };
  return {
    Select: ({
      label,
      value,
      options,
      emptyOption,
      onChange,
    }: {
      label: string;
      value: string;
      options: { value: string; label: string }[];
      emptyOption?: { value: string; label: string };
      onChange: (value: string) => void;
    }) =>
      React.createElement(
        'select',
        {
          'aria-label': label,
          value,
          onChange: (event: { target: { value: string } }) =>
            onChange(event.target.value),
        },
        [...(emptyOption ? [emptyOption] : []), ...options].map((option) =>
          React.createElement(
            'option',
            { key: option.value, value: option.value },
            option.label,
          ),
        ),
      ),
  };
});

it.each([
  ['pt-BR', brazilianPortugueseMessages],
  ['pt-PT', portugueseMessages],
] as const)(
  'renders branch settings and preparation results in %s',
  async (locale, messages) => {
    i18n.loadAndActivate({ locale, messages });
    const user = userEvent.setup();
    renderSettings();
    expect(screen.getByText('Isolar registros por filial')).toBeInTheDocument();
    expect(screen.getByText('Permissões por filial')).toBeInTheDocument();
    expect(screen.getByText('Registros existentes')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Adicionar filial' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Salvar filiais' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Filial de destino')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Preparar estrutura dos objetos' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 objetos preparados; 0 registros atribuídos.',
    );
  },
);

beforeEach(() => {
  jest.clearAllMocks();
  i18n.loadAndActivate({ locale: 'en', messages: {} });
  mockAllowed = true;
  mockAccess = {
    enabled: false,
    revision: 3,
    branches: [{ id: 'north', name: 'North', isActive: true }],
    grants: [],
  };
  mockPrepare.mockResolvedValue({
    data: {
      prepareWorkspaceBranches: { objectsPrepared: 2, recordsAssigned: 0 },
    },
  });
  mockUpdate.mockResolvedValue({ data: {} });
  mockRefetch.mockResolvedValue({});
});

const renderSettings = () =>
  render(
    <I18nProvider i18n={i18n}>
      <SettingsWorkspaceBranches />
    </I18nProvider>,
  );

it('hides administration and skips the privileged query for ordinary employees', () => {
  mockAllowed = false;
  renderSettings();
  expect(
    screen.queryByRole('button', { name: 'Save branches' }),
  ).not.toBeInTheDocument();
  expect(mockQuery).toHaveBeenCalledWith(
    expect.objectContaining({ skip: true }),
  );
});

it('prepares only object structure without disabling active isolation or assigning records', async () => {
  mockAccess.enabled = true;
  renderSettings();
  expect(
    screen.queryByRole('button', { name: 'Prepare existing records' }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Prepare object structure' }),
  );
  await waitFor(() =>
    expect(mockPrepare).toHaveBeenCalledWith({ variables: {} }),
  );
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(await screen.findByRole('status')).toHaveTextContent(
    '2 objects prepared; 0 records assigned.',
  );
});

it('requires both a concrete saved branch and explicit acknowledgement before classifying existing data', async () => {
  renderSettings();
  const prepareButton = screen.getByRole('button', {
    name: 'Prepare existing records',
  });
  expect(prepareButton).toBeDisabled();
  await userEvent.selectOptions(
    screen.getByLabelText('Destination branch'),
    'north',
  );
  expect(prepareButton).toBeDisabled();
  await userEvent.click(
    screen.getByLabelText(
      'Assign all unclassified existing records to this branch.',
    ),
  );
  await userEvent.click(prepareButton);
  await waitFor(() =>
    expect(mockPrepare).toHaveBeenCalledWith({
      variables: { branchId: 'north' },
    }),
  );
});

it('preserves the revision for concurrent-edit detection and shows a rejected activation', async () => {
  mockUpdate.mockRejectedValue(
    new Error('Assign all existing records before enabling isolation'),
  );
  renderSettings();
  await userEvent.click(screen.getByLabelText('Isolate records by branch'));
  await userEvent.click(screen.getByRole('button', { name: 'Save branches' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith({
      variables: {
        input: {
          expectedRevision: 3,
          enabled: true,
          branches: [{ id: 'north', name: 'North', isActive: true }],
          grants: [],
        },
      },
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Assign all existing records',
  );
  expect(mockRefetch).not.toHaveBeenCalled();
});
