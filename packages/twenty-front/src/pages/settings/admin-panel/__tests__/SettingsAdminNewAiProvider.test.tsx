import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsAdminNewAiProvider } from '~/pages/settings/admin-panel/SettingsAdminNewAiProvider';

const mockAddProvider = jest.fn();
jest.mock('@/settings/admin-panel/apollo/hooks/useApolloAdminClient', () => ({
  useApolloAdminClient: () => undefined,
}));
jest.mock('@/settings/admin-panel/ai/hooks/useCustomAiProviderAccess', () => ({
  useCustomAiProviderAccess: () => ({ hasAccess: true }),
}));
jest.mock('@/settings/enterprise/components/OrganizationAdornment', () => ({
  OrganizationAdornment: () => null,
}));
jest.mock('@apollo/client/react', () => ({
  useMutation: () => [mockAddProvider],
  useQuery: () => ({
    data: {
      getModelsDevProviders: [
        { id: 'openai', modelCount: 1, npm: '@ai-sdk/openai' },
      ],
    },
  }),
}));
jest.mock('twenty-ui/components/feedback', () => ({
  useToast: () => ({ enqueueToast: jest.fn() }),
  InlineBanner: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/settings/components/layout/SettingsPageLayout', () => ({
  SettingsPageLayout: ({
    actionButton,
    children,
  }: {
    actionButton: ReactNode;
    children: ReactNode;
  }) => (
    <main>
      {actionButton}
      {children}
    </main>
  ),
}));
jest.mock('@/settings/components/SettingsPageContainer', () => ({
  SettingsPageContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock(
  '@/settings/components/SaveAndCancelButtons/SaveAndCancelButtons',
  () => ({
    SaveAndCancelButtons: ({
      onSave,
      isSaveDisabled,
    }: {
      onSave: () => void;
      isSaveDisabled: boolean;
    }) => (
      <button type="button" disabled={isSaveDisabled} onClick={onSave}>
        Save
      </button>
    ),
  }),
);
jest.mock('@/ui/input/components/TextInput', () => ({
  TextInput: ({
    value,
    onChange,
    placeholder,
    type,
    error,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: string;
    error?: string;
  }) => (
    <>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
      />
      {error && <span role="alert">{error}</span>}
    </>
  ),
}));
jest.mock('@/ui/input/components/Select', () => ({
  Select: ({
    value,
    onChange,
    dropdownId,
    options,
    callToActionButton,
  }: {
    value: string;
    onChange: (value: string) => void;
    dropdownId: string;
    options: { value: string; label: string }[];
    callToActionButton?: { text: string; onClick: () => void };
  }) => (
    <>
      <select
        aria-label={
          dropdownId === 'ai-provider-api-protocol'
            ? 'API protocol'
            : dropdownId
        }
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {callToActionButton && (
        <button type="button" onClick={callToActionButton.onClick}>
          {callToActionButton.text}
        </button>
      )}
    </>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  i18n.loadAndActivate({ locale: 'en', messages: {} });
  mockAddProvider.mockResolvedValue({ data: { addAiProvider: true } });
});
const renderForm = () =>
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <SettingsAdminNewAiProvider />
      </MemoryRouter>
    </I18nProvider>,
  );

it.each([
  ['@ai-sdk/openai-compatible', 'OpenAI-compatible (Chat Completions)'],
  ['@ai-sdk/openai', 'OpenAI (Responses)'],
  ['@ai-sdk/anthropic', 'Anthropic (Messages)'],
])(
  'saves the custom endpoint and credentials for %s',
  async (npm, protocol) => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Custom provider' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'API protocol' }),
      protocol,
    );
    await user.type(
      screen.getByPlaceholderText('e.g. My OpenAI Proxy'),
      'OpenCode',
    );
    await user.type(screen.getByPlaceholderText('sk-...'), 'private-test-key');
    await user.type(
      screen.getByPlaceholderText('https://api.example.com/v1'),
      'https://opencode.ai/zen/v1',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mockAddProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            providerName: 'opencode',
            providerConfig: {
              npm,
              label: 'OpenCode',
              apiKey: 'private-test-key',
              baseUrl: 'https://opencode.ai/zen/v1',
            },
          },
        }),
      ),
    );
  },
);

it('requires a custom endpoint so a gateway key is not sent to the default provider', async () => {
  const user = userEvent.setup();
  renderForm();
  await user.click(screen.getByRole('button', { name: 'Custom provider' }));
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'API protocol' }),
    'OpenAI (Responses)',
  );
  await user.type(
    screen.getByPlaceholderText('e.g. My OpenAI Proxy'),
    'OpenCode',
  );
  await user.type(screen.getByPlaceholderText('sk-...'), 'private-test-key');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Base URL is required',
  );
  expect(mockAddProvider).not.toHaveBeenCalled();
});

it('preserves the default endpoint for a known native provider', async () => {
  const user = userEvent.setup();
  renderForm();
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'ai-provider-models-dev-select' }),
    'openai',
  );
  await user.type(screen.getByPlaceholderText('sk-...'), 'private-native-key');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(mockAddProvider).toHaveBeenCalled());
  expect(
    mockAddProvider.mock.calls[0][0].variables.providerConfig,
  ).toMatchObject({ npm: '@ai-sdk/openai', name: 'openai' });
  expect(
    mockAddProvider.mock.calls[0][0].variables.providerConfig,
  ).not.toHaveProperty('baseUrl');
});
