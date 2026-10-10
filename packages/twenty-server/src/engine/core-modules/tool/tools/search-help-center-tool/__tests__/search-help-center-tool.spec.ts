import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { SearchHelpCenterTool } from 'src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

jest.mock(
  'src/engine/core-modules/twenty-config/twenty-config.service',
  () => ({ TwentyConfigService: class {} }),
);
jest.mock(
  'src/engine/core-modules/secure-http-client/secure-http-client.service',
  () => ({ SecureHttpClientService: class {} }),
);

describe('SearchHelpCenterTool', () => {
  const post = jest.fn();
  const getHttpClient = jest.fn(() => ({ post }));
  const context = {} as ToolExecutionContext;
  let values: Record<string, unknown>;
  let tool: SearchHelpCenterTool;

  beforeEach(() => {
    jest.clearAllMocks();
    values = {};
    post.mockResolvedValue({ data: { results: [] } });
    tool = new SearchHelpCenterTool(
      { get: (key: string) => values[key] } as unknown as TwentyConfigService,
      { getHttpClient } as unknown as SecureHttpClientService,
    );
  });

  it('returns an unavailable result without making requests by default', async () => {
    expect(
      await tool.execute({ query: 'Create a workspace' }, context),
    ).toMatchObject({
      success: false,
      message: 'Help center search is not configured for this instance',
    });
    expect(getHttpClient).not.toHaveBeenCalled();
  });

  it('uses an explicitly configured search endpoint', async () => {
    values.HELP_CENTER_SEARCH_URL = 'https://help.example.org/search';
    await tool.execute({ query: 'Create a workspace' }, context);
    expect(post).toHaveBeenCalledWith(
      values.HELP_CENTER_SEARCH_URL,
      { query: 'Create a workspace', pageSize: 10 },
      { headers: { 'Content-Type': 'application/json' } },
    );
  });

  it('keeps explicitly configured Mintlify credentials', async () => {
    values.MINTLIFY_SUBDOMAIN = 'my-crm';
    values.MINTLIFY_API_KEY = 'configured-key';
    await tool.execute({ query: 'Create a workspace' }, context);
    expect(post).toHaveBeenCalledWith(
      'https://api-dsc.mintlify.com/v1/search/my-crm',
      expect.any(Object),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer configured-key',
        },
      },
    );
  });
});
