import { type QueryRunner } from 'typeorm';
import { EncryptSensitiveJsonConfigFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-47/2-47-instance-command-fast-1791890357236-encrypt-sensitive-json-config';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { type EnvironmentConfigDriver } from 'src/engine/core-modules/twenty-config/drivers/environment-config.driver';

const encryption = new SecretEncryptionService({
  get: (key: string) => key === 'APP_SECRET' ? 'migration-test-secret' : undefined,
} as unknown as EnvironmentConfigDriver);

describe('sensitive JSON configuration upgrade', () => {
  it('encrypts legacy JSON once and leaves existing ciphertext unchanged', async () => {
    const config = { provider: { apiKey: 'migration-private-key' } };
    const query = jest.fn().mockResolvedValueOnce([{ id: 'config', value: config }]).mockResolvedValue([]);
    const runner = { query } as unknown as QueryRunner;
    const command = new EncryptSensitiveJsonConfigFastInstanceCommand(encryption);
    await command.up(runner);
    const encrypted = query.mock.calls[1][1][0];
    expect(encryption.decryptVersionedOrThrow(encrypted)).toBe(JSON.stringify(config));
    expect(encrypted).not.toContain('migration-private-key');
    expect(query.mock.calls[0][1][1]).toContain('AI_PROVIDERS');
    expect(query.mock.calls[1][0]).toContain('value = $3::jsonb');
    query.mockClear().mockResolvedValueOnce([{ id: 'config', value: encrypted }]);
    await command.up(runner);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not undo encryption on rollback', async () => {
    const query = jest.fn();
    await new EncryptSensitiveJsonConfigFastInstanceCommand(encryption).down({ query } as unknown as QueryRunner);
    expect(query).not.toHaveBeenCalled();
  });
});
