import { BadRequestException, Injectable } from '@nestjs/common';
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
      steps: settings?.steps ?? null,
    };
  }

  async update(
    workspaceId: string,
    input: UpdateRecordFormSettingsInput,
  ): Promise<RecordFormSettingsDTO> {
    if (!input.objectMetadataId && input.steps?.length) {
      throw new BadRequestException(
        'Field groups must be configured for an object',
      );
    }
    const fieldMetadataIds = (input.steps ?? []).flatMap(
      (step) => step.fieldMetadataIds,
    );
    if (new Set(fieldMetadataIds).size !== fieldMetadataIds.length) {
      throw new BadRequestException('A field can only belong to one step');
    }
    const previousSettings = await this.find(
      workspaceId,
      input.objectMetadataId,
    );
    const settings = {
      presentation:
        input.presentation === undefined
          ? previousSettings.presentation
          : input.presentation,
      steps: input.steps === undefined ? previousSettings.steps : input.steps,
    };
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
