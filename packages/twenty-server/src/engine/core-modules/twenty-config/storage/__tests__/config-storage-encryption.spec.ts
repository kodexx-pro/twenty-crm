import { Logger } from '@nestjs/common';
import { type Repository } from 'typeorm';

import { type KeyValuePairEntity } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { isEncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/is-encrypted-string.util';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';
import { ConfigValueConverterService } from 'src/engine/core-modules/twenty-config/conversion/config-value-converter.service';
import { type EnvironmentConfigDriver } from 'src/engine/core-modules/twenty-config/drivers/environment-config.driver';
import { ConfigStorageService } from 'src/engine/core-modules/twenty-config/storage/config-storage.service';

describe('sensitive configuration encryption', () => {
  const providers = {
    opencode: {
      npm: '@ai-sdk/openai-compatible' as const,
      apiKey: 'private-provider-key',
      baseUrl: 'https://opencode.ai/zen/v1',
      models: [{ name: 'test-model', label: 'Test model' }],
    },
  };
  const repository = {
    findOne: jest.fn(),
    find: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  const encryption = new SecretEncryptionService({
    get: (key: string) =>
      key === 'APP_SECRET' ? 'configuration-encryption-test-secret' : undefined,
  } as unknown as EnvironmentConfigDriver);
  const storage = new ConfigStorageService(
    repository as unknown as Repository<KeyValuePairEntity>,
    new ConfigValueConverterService(new ConfigVariables()),
    encryption,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findOne.mockResolvedValue(null);
  });

  it('encrypts the complete provider configuration and decrypts it on get and loadAll', async () => {
    await storage.set('AI_PROVIDERS', providers);
    const stored = repository.insert.mock.calls[0][0].value;
    expect(typeof stored).toBe('string');
    expect(isEncryptedString(stored)).toBe(true);
    expect(stored).not.toContain(providers.opencode.apiKey);
    repository.findOne.mockResolvedValue({
      key: 'AI_PROVIDERS',
      value: stored,
    });
    repository.find.mockResolvedValue([{ key: 'AI_PROVIDERS', value: stored }]);
    expect(await storage.get('AI_PROVIDERS')).toEqual(providers);
    expect((await storage.loadAll()).get('AI_PROVIDERS')).toEqual(providers);
  });

  it('reads legacy JSON so upgrades can encrypt existing configurations', async () => {
    repository.findOne.mockResolvedValue({ value: providers });
    expect(await storage.get('AI_PROVIDERS')).toEqual(providers);
  });

  it('keeps null configuration values unset', async () => {
    repository.findOne.mockResolvedValue({ value: null });
    expect(await storage.get('AI_PROVIDERS')).toBeUndefined();
  });

  it('continues encrypting sensitive strings without changing their format', async () => {
    await storage.set('OPENAI_API_KEY', 'private-openai-key');
    const stored = repository.insert.mock.calls[0][0].value;
    repository.findOne.mockResolvedValue({ value: stored });
    expect(isEncryptedString(stored)).toBe(true);
    expect(await storage.get('OPENAI_API_KEY')).toBe('private-openai-key');
  });

  it('leaves non-sensitive configuration arrays unchanged', async () => {
    const models = ['opencode/test-model'];
    await storage.set('AI_MODELS_DEFAULT_FAST', models);
    expect(repository.insert.mock.calls[0][0].value).toEqual(models);
  });

  it('does not log legacy provider credentials', async () => {
    const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    repository.findOne.mockResolvedValue({ value: providers });
    await storage.get('AI_PROVIDERS');
    expect(JSON.stringify(debug.mock.calls)).not.toContain(
      providers.opencode.apiKey,
    );
    debug.mockRestore();
  });

  it('rejects ciphertext encrypted with another key', async () => {
    const otherEncryption = new SecretEncryptionService({
      get: (key: string) =>
        key === 'APP_SECRET' ? 'different-test-secret' : undefined,
    } as unknown as EnvironmentConfigDriver);
    const otherStorage = new ConfigStorageService(
      repository as unknown as Repository<KeyValuePairEntity>,
      new ConfigValueConverterService(new ConfigVariables()),
      otherEncryption,
    );
    await storage.set('AI_PROVIDERS', providers);
    repository.findOne.mockResolvedValue({
      value: repository.insert.mock.calls[0][0].value,
    });
    await expect(otherStorage.get('AI_PROVIDERS')).rejects.toThrow();
  });
});
