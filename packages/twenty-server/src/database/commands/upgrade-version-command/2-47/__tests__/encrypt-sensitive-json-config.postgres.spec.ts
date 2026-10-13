import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { type QueryRunner } from 'typeorm';
import { EncryptSensitiveJsonConfigFastInstanceCommand } from 'src/database/commands/upgrade-version-command/2-47/2-47-instance-command-fast-1791890357236-encrypt-sensitive-json-config';
import { isEncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/is-encrypted-string.util';
import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { type EnvironmentConfigDriver } from 'src/engine/core-modules/twenty-config/drivers/environment-config.driver';

const databaseUrl = process.env.BRANCH_ISOLATION_TEST_DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('sensitive JSON upgrade against PostgreSQL', () => {
  let client: Client;
  const config = { provider: { apiKey: 'legacy-secret' } };
  const encryption = new SecretEncryptionService({
    get: (key: string) => key === 'APP_SECRET' ? 'postgres-migration-test-secret' : undefined,
  } as unknown as EnvironmentConfigDriver);
  const command = new EncryptSensitiveJsonConfigFastInstanceCommand(encryption);

  beforeEach(async () => {
    jest.useRealTimers();
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/branch_isolation_test') {
      throw new Error('Encryption tests require the dedicated branch_isolation_test database');
    }
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA IF NOT EXISTS core');
    await client.query(`CREATE TABLE IF NOT EXISTS core."keyValuePair" (
      id uuid PRIMARY KEY, type text, key text, value jsonb,
      "userId" uuid, "workspaceId" uuid, "applicationId" uuid
    )`);
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
    await client.end();
  });

  const insert = async (key: string, value: unknown, workspaceId: string | null = null) => {
    const id = randomUUID();
    await client.query(`INSERT INTO core."keyValuePair" (id, type, key, value, "workspaceId")
      VALUES ($1, 'CONFIG_VARIABLE', $2, $3::jsonb, $4)`, [id, key, JSON.stringify(value), workspaceId]);
    return id;
  };
  const read = async (id: string): Promise<unknown> =>
    (await client.query('SELECT value FROM core."keyValuePair" WHERE id = $1', [id])).rows[0].value;
  const runner = () => ({
    query: async (sql: string, params?: unknown[]) => (await client.query(sql, params)).rows,
  }) as unknown as QueryRunner;

  it('backfills global provider secrets without changing non-sensitive or workspace values', async () => {
    const global = await insert('AI_PROVIDERS', config);
    const ordinary = await insert('AI_MODELS_DEFAULT_FAST', ['provider/model']);
    const workspace = await insert('AI_PROVIDERS', config, randomUUID());
    await command.up(runner());
    const stored = await read(global);
    expect(typeof stored).toBe('string');
    expect(isEncryptedString(stored as string)).toBe(true);
    expect(JSON.parse(encryption.decryptVersionedOrThrow(stored as EncryptedString))).toEqual(config);
    expect(await read(ordinary)).toEqual(['provider/model']);
    expect(await read(workspace)).toEqual(config);
    await command.up(runner());
    expect(await read(global)).toBe(stored);
  });

  it('preserves a newer credential edit during backfill', async () => {
    const id = await insert('AI_PROVIDERS', config);
    const newer = { provider: { apiKey: 'newer-secret' } };
    let edited = false;
    const concurrentRunner = {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('UPDATE') && !edited) {
          edited = true;
          await client.query('UPDATE core."keyValuePair" SET value = $1::jsonb WHERE id = $2', [JSON.stringify(newer), id]);
        }
        return (await client.query(sql, params)).rows;
      },
    } as unknown as QueryRunner;
    await command.up(concurrentRunner);
    expect(await read(id)).toEqual(newer);
    await command.up(runner());
    expect(JSON.parse(encryption.decryptVersionedOrThrow(await read(id) as EncryptedString))).toEqual(newer);
  });
});
