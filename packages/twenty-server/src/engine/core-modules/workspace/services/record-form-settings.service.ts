import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import {
  RecordFormPresentation,
  type RecordFormSettingsDTO,
  type UpdateRecordFormSettingsInput,
} from 'src/engine/core-modules/workspace/dtos/record-form-settings.dto';

@Injectable()
export class RecordFormSettingsService {
  constructor(
    @InjectRepository(KeyValuePairEntity)
    private readonly repository: Repository<KeyValuePairEntity>,
  ) {}

  private getKey(objectMetadataId?: string | null) {
    return `record-form-settings:${objectMetadataId ?? 'workspace'}`;
  }

  async find(
    workspaceId: string,
    objectMetadataId?: string | null,
  ): Promise<RecordFormSettingsDTO> {
    const entry = await this.repository.findOne({
      where: {
        workspaceId,
        userId: IsNull(),
        applicationId: IsNull(),
        key: this.getKey(objectMetadataId),
        type: KeyValuePairType.CONFIG_VARIABLE,
      },
    });
    const settings = entry?.value as unknown as
      | RecordFormSettingsDTO
      | undefined;
    return {
      presentation:
        settings?.presentation ??
        (objectMetadataId ? null : RecordFormPresentation.SIDE_PANEL),
    };
  }

  async update(
    workspaceId: string,
    input: UpdateRecordFormSettingsInput,
  ): Promise<RecordFormSettingsDTO> {
    const settings = { presentation: input.presentation ?? null };
    await this.repository.upsert(
      {
        workspaceId,
        userId: null,
        applicationId: null,
        key: this.getKey(input.objectMetadataId),
        type: KeyValuePairType.CONFIG_VARIABLE,
        value: settings as unknown as JSON,
      },
      {
        conflictPaths: ['key', 'workspaceId'],
        indexPredicate: '"userId" IS NULL AND "applicationId" IS NULL',
      },
    );
    return this.find(workspaceId, input.objectMetadataId);
  }
}
