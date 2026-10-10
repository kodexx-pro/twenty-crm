import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateRecordFormSettingsInput } from 'src/engine/core-modules/workspace/dtos/record-form-settings.dto';

describe('UpdateRecordFormSettingsInput', () => {
  it('accepts named field groups for a wizard', async () => {
    expect(
      await validate(
        plainToInstance(UpdateRecordFormSettingsInput, {
          presentation: 'WIZARD',
          objectMetadataId: 'c7bc1cf5-8317-481a-ae37-2f83295c0b44',
          steps: [
            {
              title: 'Details',
              fieldMetadataIds: ['cc5d843c-7bce-47d6-842a-73e2a5d0c98a'],
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it.each([
    { presentation: 'INVALID' },
    { objectMetadataId: 'not-a-uuid' },
    { steps: [{ title: ' ', fieldMetadataIds: [] }] },
    { steps: [{ title: 'Details', fieldMetadataIds: ['not-a-uuid'] }] },
    {
      steps: Array.from({ length: 21 }, () => ({
        title: 'Details',
        fieldMetadataIds: [],
      })),
    },
  ])('rejects malformed configuration: %j', async (input) => {
    expect(
      (await validate(plainToInstance(UpdateRecordFormSettingsInput, input)))
        .length,
    ).toBeGreaterThan(0);
  });
});
