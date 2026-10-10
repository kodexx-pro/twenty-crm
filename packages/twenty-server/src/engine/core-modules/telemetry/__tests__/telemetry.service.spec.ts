import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { TelemetryService } from 'src/engine/core-modules/telemetry/telemetry.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

jest.mock(
  'src/engine/core-modules/twenty-config/twenty-config.service',
  () => ({
    TwentyConfigService: class {},
  }),
);
jest.mock(
  'src/engine/core-modules/secure-http-client/secure-http-client.service',
  () => ({
    SecureHttpClientService: class {},
  }),
);

describe('TelemetryService', () => {
  const payload: Parameters<TelemetryService['publish']>[0] = {
    action: USER_SIGNUP_EVENT_NAME,
    events: [
      {
        userId: 'user-id',
        serverId: 'server-id',
        serverUrl: 'https://crm.example.org',
      },
    ],
  };
  const post = jest.fn();
  const getHttpClient = jest.fn(() => ({ post }));
  let values: Record<string, unknown>;
  let service: TelemetryService;

  beforeEach(() => {
    jest.clearAllMocks();
    values = {};
    service = new TelemetryService(
      { get: (key: string) => values[key] } as unknown as TwentyConfigService,
      { getHttpClient } as unknown as SecureHttpClientService,
    );
  });

  it('does not create an HTTP client when disabled, even with a configured URL', async () => {
    values.TELEMETRY_API_URL = 'https://telemetry.example.org/api';
    expect(await service.publish(payload)).toEqual({ success: true });
    expect(getHttpClient).not.toHaveBeenCalled();
  });

  it('does not send data when enabled without an explicitly configured URL', async () => {
    values.TELEMETRY_ENABLED = true;
    expect(await service.publish(payload)).toEqual({ success: true });
    expect(getHttpClient).not.toHaveBeenCalled();
  });

  it('sends events only to the configured endpoint', async () => {
    values.TELEMETRY_ENABLED = true;
    values.TELEMETRY_API_URL = 'https://telemetry.example.org/api';
    post.mockResolvedValueOnce({});
    expect(await service.publish(payload)).toEqual({ success: true });
    expect(getHttpClient).toHaveBeenCalledWith({
      baseURL: values.TELEMETRY_API_URL,
    });
    expect(post).toHaveBeenCalledWith('/selfHostingEvent', {
      action: payload.action,
      ...payload.events[0],
    });
  });

  it('reports a configured transport failure without throwing', async () => {
    values.TELEMETRY_ENABLED = true;
    values.TELEMETRY_API_URL = 'https://telemetry.example.org/api';
    post.mockRejectedValueOnce(new Error('Unavailable'));
    expect(await service.publish(payload)).toEqual({ success: false });
  });
});
import { USER_SIGNUP_EVENT_NAME } from 'src/engine/api/graphql/workspace-query-runner/constants/user-signup-event-name.constants';
