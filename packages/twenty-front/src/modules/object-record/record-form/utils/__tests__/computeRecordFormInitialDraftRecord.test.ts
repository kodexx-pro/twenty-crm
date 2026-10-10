import { computeRecordFormInitialDraftRecord } from '@/object-record/record-form/utils/computeRecordFormInitialDraftRecord';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

it('restores a relation from the loaded record when only its object value is present', () => {
  const draft = computeRecordFormInitialDraftRecord({
    record: {
      id: 'person-a',
      __typename: 'Person',
      company: { id: 'company-a' },
    },
    fieldMetadataItems: getMockObjectMetadataItemOrThrow('person').fields,
  });
  expect(draft.companyId).toBe('company-a');
});

it('restores a polymorphic relation for the shared form picker', () => {
  const draft = computeRecordFormInitialDraftRecord({
    record: {
      id: 'pet-a',
      __typename: 'Pet',
      name: 'Rex',
      polymorphicOwnerRocketId: 'rocket-a',
    },
    fieldMetadataItems: getMockObjectMetadataItemOrThrow('pet').fields,
  });
  expect(draft.polymorphicOwner).toEqual({
    id: 'rocket-a',
    targetObjectMetadataId: getMockObjectMetadataItemOrThrow('rocket').id,
  });
  expect(draft.name).toBe('Rex');
});
