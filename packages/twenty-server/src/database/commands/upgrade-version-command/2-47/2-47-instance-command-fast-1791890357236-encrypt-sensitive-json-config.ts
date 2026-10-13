import { type QueryRunner } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';

import { KeyValuePairType } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { isEncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/is-encrypted-string.util';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';
import { type ConfigVariablesMetadataMap } from 'src/engine/core-modules/twenty-config/decorators/config-variables-metadata.decorator';
import { ConfigVariableType } from 'src/engine/core-modules/twenty-config/enums/config-variable-type.enum';
import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';
import { TypedReflect } from 'src/utils/typed-reflect';

@RegisteredInstanceCommand('2.47.0', 1791890357236)
export class EncryptSensitiveJsonConfigFastInstanceCommand
  implements FastInstanceCommand
{
  constructor(
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

  public async up(queryRunner: QueryRunner): Promise<void> {
    const metadata = TypedReflect.getMetadata(
      'config-variables',
      ConfigVariables,
    ) as ConfigVariablesMetadataMap | undefined;
    if (!isDefined(metadata)) return;
    const keys = Object.entries(metadata)
      .filter(
        ([, descriptor]) =>
          descriptor?.isSensitive === true &&
          descriptor.type === ConfigVariableType.JSON,
      )
      .map(([key]) => key);
    if (keys.length === 0) return;

    const rows: { id: string; value: unknown }[] = await queryRunner.query(
      `SELECT id, value FROM "core"."keyValuePair"
       WHERE type = $1 AND key = ANY($2::text[])
         AND "userId" IS NULL AND "workspaceId" IS NULL
         AND "applicationId" IS NULL AND value IS NOT NULL`,
      [KeyValuePairType.CONFIG_VARIABLE, keys],
    );
    for (const row of rows) {
      if (
        row.value === null ||
        (typeof row.value === 'string' && isEncryptedString(row.value))
      ) {
        continue;
      }
      const serialized = JSON.stringify(row.value);
      const encrypted = this.secretEncryptionService.encryptVersioned(
        serialized as PlaintextString,
      );
      // Avoid replacing credentials edited after the row was read.
      await queryRunner.query(
        `UPDATE "core"."keyValuePair"
         SET value = to_jsonb($1::text)
         WHERE id = $2 AND value = $3::jsonb`,
        [encrypted, row.id, serialized],
      );
    }
  }

  // A rollback must not expose secrets in plaintext again.
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
