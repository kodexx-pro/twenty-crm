import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import { useOpenUpdateMultipleRecordsPageInSidePanel } from '@/side-panel/hooks/useOpenUpdateMultipleRecordsPageInSidePanel';
import { EditRecordFormCommand } from '@/command-menu-item/engine-command/record/single-record/components/EditRecordFormCommand';
import { useRecordFormSettings } from '@/object-record/record-form/hooks/useRecordFormSettings';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { FeatureFlagKey } from 'twenty-shared/types';

export const UpdateMultipleRecordsCommand = () => {
  const { contextStoreInstanceId, objectMetadataItem, selectedRecords } =
    useHeadlessCommandContextApi();
  const isRecordFormEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_RECORD_CREATION_FORM_ENABLED,
  );
  const { presentation, loading, objectSettings } = useRecordFormSettings(
    objectMetadataItem?.id ?? '',
    !isRecordFormEnabled || !objectMetadataItem || selectedRecords.length !== 1,
  );

  const { openUpdateMultipleRecordsPageInSidePanel } =
    useOpenUpdateMultipleRecordsPageInSidePanel({
      contextStoreInstanceId,
    });

  const handleExecute = () => {
    openUpdateMultipleRecordsPageInSidePanel();
  };

  if (
    isRecordFormEnabled &&
    objectMetadataItem &&
    selectedRecords.length === 1
  ) {
    if (loading) return null;
    if (presentation !== 'SIDE_PANEL')
      return (
        <EditRecordFormCommand
          objectMetadataItem={objectMetadataItem}
          recordId={selectedRecords[0].id}
          presentation={presentation}
          steps={objectSettings?.steps}
        />
      );
  }

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
