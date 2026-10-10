import { type Repository } from 'typeorm';
import { type KeyValuePairEntity } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { RecordFormPresentation } from 'src/engine/core-modules/workspace/dtos/record-form-settings.dto';
import { RecordFormSettingsService } from 'src/engine/core-modules/workspace/services/record-form-settings.service';

jest.mock(
  'src/engine/core-modules/key-value-pair/key-value-pair.entity',
  () => ({
    KeyValuePairEntity: class KeyValuePairEntity {},
    KeyValuePairType: { CONFIG_VARIABLE: 'CONFIG_VARIABLE' },
  }),
);

describe('RecordFormSettingsService', () => {
  const findOne = jest.fn();
  const upsert = jest.fn();
  const service = new RecordFormSettingsService({
    findOne,
    upsert,
  } as unknown as Repository<KeyValuePairEntity>);

  beforeEach(() => {
    findOne.mockReset();
    upsert.mockReset();
  });

  it('keeps side panels as the workspace default and objects inheriting', async () => {
    findOne.mockResolvedValue(null);
    expect(await service.find('workspace-a')).toEqual({
      presentation: 'SIDE_PANEL',
      steps: null,
    });
    expect(await service.find('workspace-a', 'object-a')).toEqual({
      presentation: null,
      steps: null,
    });
  });

  it('isolates reads by workspace and object', async () => {
    findOne.mockResolvedValue({ value: { presentation: 'DIALOG' } });
    expect(await service.find('workspace-a', 'object-a')).toEqual({
      presentation: 'DIALOG',
      steps: null,
    });
    expect(findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: 'workspace-a',
        key: 'record-form-settings:object-a',
        type: 'CONFIG_VARIABLE',
        userId: expect.anything(),
        applicationId: expect.anything(),
      }),
    });
  });

  it('persists a setting in workspace storage without a user or application owner', async () => {
    findOne.mockResolvedValue({ value: { presentation: 'DIALOG' } });
    await service.update('workspace-a', {
      presentation: RecordFormPresentation.DIALOG,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-a',
        userId: null,
        applicationId: null,
        key: 'record-form-settings:workspace',
        value: { presentation: 'DIALOG', steps: null },
      }),
      expect.objectContaining({ conflictPaths: ['key', 'workspaceId'] }),
    );
  });

  it('can clear an object override without changing the workspace default', async () => {
    findOne.mockResolvedValue({ value: { presentation: null } });
    expect(
      await service.update('workspace-a', {
        objectMetadataId: 'object-a',
        presentation: null,
      }),
    ).toEqual({ presentation: null, steps: null });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'record-form-settings:object-a',
        value: { presentation: null, steps: null },
      }),
      expect.anything(),
    );
  });

  it('preserves field groups when changing presentation', async () => {
    const steps = [{ title: 'Details', fieldMetadataIds: ['field-a'] }];
    findOne.mockResolvedValue({ value: { presentation: 'WIZARD', steps } });
    await service.update('workspace-a', {
      objectMetadataId: 'object-a',
      presentation: RecordFormPresentation.DIALOG,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ value: { presentation: 'DIALOG', steps } }),
      expect.anything(),
    );
  });

  it('rejects duplicate field assignments and workspace-wide field groups', async () => {
    await expect(
      service.update('workspace-a', {
        objectMetadataId: 'object-a',
        steps: [
          { title: 'First', fieldMetadataIds: ['field-a'] },
          { title: 'Second', fieldMetadataIds: ['field-a'] },
        ],
      }),
    ).rejects.toThrow('A field can only belong to one step');
    await expect(
      service.update('workspace-a', {
        steps: [{ title: 'Details', fieldMetadataIds: ['field-a'] }],
      }),
    ).rejects.toThrow('Field groups must be configured for an object');
    expect(upsert).not.toHaveBeenCalled();
  });
});
