import { computeRecordFormSteps } from '@/object-record/record-form/utils/computeRecordFormSteps';

const field = (id: string, isVisible = true) => ({
  fieldMetadataItem: { id },
  widgets: [],
  isVisible,
});

describe('computeRecordFormSteps', () => {
  it('groups visible fields and keeps hidden fields on the last step', () => {
    const fields = [
      ...Array.from({ length: 8 }, (_, index) => field(String(index))),
      field('hidden', false),
    ];
    const steps = computeRecordFormSteps({ recordFormFields: fields });
    expect(
      steps.map((step) => step.fields.map((item) => item.fieldMetadataItem.id)),
    ).toEqual([
      ['0', '1', '2', '3', '4', '5'],
      ['6', '7', 'hidden'],
    ]);
  });

  it('keeps new fields reachable and deduplicates stale assignments', () => {
    const steps = computeRecordFormSteps({
      recordFormFields: [field('a'), field('b'), field('new')],
      configuredSteps: [
        { title: 'Details', fieldMetadataIds: ['a', 'deleted'] },
        { title: 'Other', fieldMetadataIds: ['a', 'b'] },
      ],
    });
    expect(
      steps.map((step) => ({
        title: step.title,
        ids: step.fields.map((item) => item.fieldMetadataItem.id),
      })),
    ).toEqual([
      { title: 'Details', ids: ['a'] },
      { title: 'Other', ids: ['b', 'new'] },
    ]);
  });

  it('skips hidden-only steps and keeps their fields reachable on the last visible step', () => {
    const steps = computeRecordFormSteps({
      recordFormFields: [field('a'), field('hidden', false)],
      configuredSteps: [
        { title: 'Hidden', fieldMetadataIds: ['hidden'] },
        { title: 'Details', fieldMetadataIds: ['a'] },
      ],
    });
    expect(steps).toEqual([
      { title: 'Details', fields: [field('a'), field('hidden', false)] },
    ]);
  });

  it('uses a configured title when all fields are unassigned', () => {
    expect(
      computeRecordFormSteps({
        recordFormFields: [field('a')],
        configuredSteps: [{ title: 'Details', fieldMetadataIds: [] }],
      }),
    ).toEqual([{ title: 'Details', fields: [field('a')] }]);
  });

  it('still exposes a submit step for an empty or entirely hidden form', () => {
    expect(computeRecordFormSteps({ recordFormFields: [] })).toEqual([
      { title: null, fields: [] },
    ]);
    expect(
      computeRecordFormSteps({ recordFormFields: [field('hidden', false)] })[0]
        .fields,
    ).toEqual([field('hidden', false)]);
  });
});
