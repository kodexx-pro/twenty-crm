import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { useRecordCreationFormContextOrThrow } from '@/object-record/record-form/contexts/RecordCreationFormContext';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useCallback } from 'react';
import { FeatureFlagKey } from '~/generated-metadata/graphql';
import { useRecordFormSettings } from '@/object-record/record-form/hooks/useRecordFormSettings';

export const useRecordCreationForm = ({
  objectMetadataItem,
}: {
  objectMetadataItem: EnrichedObjectMetadataItem;
}) => {
  const { requestRecordCreation: requestRecordCreationInContext } =
    useRecordCreationFormContextOrThrow();

  const isRecordCreationFormEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_RECORD_CREATION_FORM_ENABLED,
  );
  const { loadSettings } = useRecordFormSettings(
    objectMetadataItem.id,
    !isRecordCreationFormEnabled,
  );

  const requestRecordCreation = useCallback(
    async ({
      initialDraftRecord,
      createRecord,
    }: {
      initialDraftRecord?: Partial<ObjectRecord>;
      createRecord: (
        draftRecord: Partial<ObjectRecord>,
      ) => Promise<ObjectRecord>;
    }) => {
      const settings = await loadSettings();
      return requestRecordCreationInContext({
        objectMetadataItem,
        initialDraftRecord,
        createRecord,
        presentation:
          settings?.object.presentation ??
          settings?.workspace.presentation ??
          'SIDE_PANEL',
        steps: settings?.object.steps,
      });
    },
    [requestRecordCreationInContext, objectMetadataItem, loadSettings],
  );

  return { isRecordCreationFormEnabled, requestRecordCreation };
};
