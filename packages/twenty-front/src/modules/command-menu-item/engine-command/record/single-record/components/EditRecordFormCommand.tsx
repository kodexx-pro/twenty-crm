import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useRecordCreationFormContextOrThrow } from '@/object-record/record-form/contexts/RecordCreationFormContext';
import { computeRecordFormInitialDraftRecord } from '@/object-record/record-form/utils/computeRecordFormInitialDraftRecord';
import { type RecordFormPresentation } from '@/object-record/record-form/types/RecordFormSettings';
import { t } from '@lingui/core/macro';
import { useToast } from 'twenty-ui/components/feedback';

type EditRecordFormCommandProps = {
  objectMetadataItem: EnrichedObjectMetadataItem;
  recordId: string;
  presentation: RecordFormPresentation;
};

export const EditRecordFormCommand = ({
  objectMetadataItem,
  recordId,
  presentation,
}: EditRecordFormCommandProps) => {
  const { record, loading, error } = useFindOneRecord({
    objectNameSingular: objectMetadataItem.nameSingular,
    objectRecordId: recordId,
  });
  const { updateOneRecord } = useUpdateOneRecord();
  const { requestRecordCreation } = useRecordCreationFormContextOrThrow();
  const { enqueueToast } = useToast();

  if (loading) return null;

  return (
    <HeadlessEngineCommandWrapperEffect
      execute={async () => {
        if (!record || error) {
          enqueueToast({
            variant: 'error',
            children: t`Could not load this record. Please try again.`,
          });
          return;
        }
        await requestRecordCreation({
          objectMetadataItem,
          initialDraftRecord: computeRecordFormInitialDraftRecord({
            record,
            fieldMetadataItems: objectMetadataItem.fields,
          }),
          presentation,
          mode: 'edit',
          createRecord: (draftRecord) =>
            updateOneRecord({
              objectNameSingular: objectMetadataItem.nameSingular,
              idToUpdate: recordId,
              updateOneRecordInput: draftRecord,
            }),
        });
      }}
    />
  );
};
