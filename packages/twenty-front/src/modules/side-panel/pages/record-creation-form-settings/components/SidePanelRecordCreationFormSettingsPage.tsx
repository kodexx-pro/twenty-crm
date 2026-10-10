import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { useRecordFormFields } from '@/object-record/record-form/hooks/useRecordFormFields';
import { type RecordFormField } from '@/object-record/record-form/types/RecordFormField';
import { isFieldMetadataItemEligibleForRecordForm } from '@/object-record/record-form/utils/isFieldMetadataItemEligibleForRecordForm';
import { useUpdatePageLayoutWidgetsIsActive } from '@/page-layout/hooks/useUpdatePageLayoutWidgetsIsActive';
import { getSettingsFieldTypeConfig } from '@/settings/data-model/utils/getSettingsFieldTypeConfig';
import { isFieldTypeSupportedInSettings } from '@/settings/data-model/utils/isFieldTypeSupportedInSettings';
import { SidePanelGroup } from '@/side-panel/components/SidePanelGroup';
import { useSidePanelHistory } from '@/side-panel/hooks/useSidePanelHistory';
import { recordCreationFormSettingsObjectMetadataIdComponentState } from '@/side-panel/pages/record-creation-form-settings/states/recordCreationFormSettingsObjectMetadataIdComponentState';
import { computePageLayoutWidgetIsActiveUpdates } from '@/side-panel/pages/record-creation-form-settings/utils/computePageLayoutWidgetIsActiveUpdates';
import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { SidePanelFooter } from '@/ui/layout/side-panel/components/SidePanelFooter';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { LightIconButton } from 'twenty-ui/components/input';
import { MenuItem } from 'twenty-ui/components/navigation';
import { IconEye, IconEyeOff, useIcons } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';
import { Select } from '@/ui/input/components/Select';
import { useRecordFormSettings } from '@/object-record/record-form/hooks/useRecordFormSettings';
import { type RecordFormPresentation } from '@/object-record/record-form/types/RecordFormSettings';
import { useToast } from 'twenty-ui/components/feedback';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]};
`;

export const SidePanelRecordCreationFormSettingsPage = () => {
  const recordCreationFormSettingsObjectMetadataId = useAtomComponentStateValue(
    recordCreationFormSettingsObjectMetadataIdComponentState,
  );

  if (!isDefined(recordCreationFormSettingsObjectMetadataId)) {
    return null;
  }

  return (
    <SidePanelRecordCreationFormSettings
      objectMetadataId={recordCreationFormSettingsObjectMetadataId}
    />
  );
};

export const SidePanelRecordCreationFormSettings = ({
  objectMetadataId,
  onClose,
}: {
  objectMetadataId: string;
  onClose?: () => void;
}) => {
  const { t } = useLingui();
  const { enqueueToast } = useToast();
  const { objectSettings, workspaceSettings, saveSettings, loading, error } =
    useRecordFormSettings(objectMetadataId);
  const [presentationDraft, setPresentationDraft] = useState<
    RecordFormPresentation | 'INHERIT'
  >();
  const [workspacePresentationDraft, setWorkspacePresentationDraft] =
    useState<RecordFormPresentation>();
  const { getIcon } = useIcons();
  const { objectMetadataItem } = useObjectMetadataItemById({
    objectId: objectMetadataId,
  });
  const { recordFormFields } = useRecordFormFields({ objectMetadataItem });
  const configurableRecordFormFields = recordFormFields.filter(
    ({ fieldMetadataItem }) =>
      isFieldMetadataItemEligibleForRecordForm(fieldMetadataItem),
  );
  const { goBackFromSidePanel, removePageFromSidePanelHistory } =
    useSidePanelHistory();
  const sidePanelPageId = useAvailableComponentInstanceIdOrThrow(
    SidePanelPageComponentInstanceContext,
  );
  const { updatePageLayoutWidgetsIsActive } =
    useUpdatePageLayoutWidgetsIsActive();

  const [isVisibleByFieldMetadataId, setIsVisibleByFieldMetadataId] = useState<
    Record<string, boolean>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const isRecordFormFieldVisible = (recordFormField: RecordFormField) =>
    isVisibleByFieldMetadataId[recordFormField.fieldMetadataItem.id] ??
    recordFormField.isVisible;

  const handleToggleVisibility = (recordFormField: RecordFormField) => {
    if (isSaving) {
      return;
    }

    setIsVisibleByFieldMetadataId((previousIsVisibleByFieldMetadataId) => ({
      ...previousIsVisibleByFieldMetadataId,
      [recordFormField.fieldMetadataItem.id]:
        !isRecordFormFieldVisible(recordFormField),
    }));
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    const pageLayoutWidgetIsActiveUpdates =
      computePageLayoutWidgetIsActiveUpdates({
        recordFormFields: configurableRecordFormFields,
        isVisibleByFieldMetadataId,
      });

    setIsSaving(true);

    try {
      if (presentationDraft !== undefined)
        await saveSettings({
          presentation:
            presentationDraft === 'INHERIT' ? null : presentationDraft,
        });
      if (workspacePresentationDraft !== undefined)
        await saveSettings({ presentation: workspacePresentationDraft }, true);
      const { status } = await updatePageLayoutWidgetsIsActive(
        pageLayoutWidgetIsActiveUpdates,
      );

      if (status === 'successful') {
        if (onClose) onClose();
        else removePageFromSidePanelHistory(sidePanelPageId);
      }
    } catch {
      enqueueToast({
        variant: 'error',
        children: t`Could not save form settings. Please try again.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StyledContainer>
      <StyledContent>
        <SidePanelGroup heading={t`Presentation`}>
          <Select
            dropdownId={`record-form-presentation-${objectMetadataId}`}
            label={t`This object`}
            disabled={loading || isSaving || Boolean(error)}
            value={
              presentationDraft ?? objectSettings?.presentation ?? 'INHERIT'
            }
            onChange={setPresentationDraft}
            options={[
              { value: 'INHERIT' as const, label: t`Use workspace default` },
              { value: 'SIDE_PANEL' as const, label: t`Side panel` },
              { value: 'DIALOG' as const, label: t`Centered dialog` },
            ]}
            fullWidth
          />
          <Select
            dropdownId={`record-form-workspace-presentation-${objectMetadataId}`}
            label={t`Workspace default`}
            disabled={loading || isSaving || Boolean(error)}
            value={
              workspacePresentationDraft ??
              workspaceSettings?.presentation ??
              'SIDE_PANEL'
            }
            onChange={setWorkspacePresentationDraft}
            options={[
              { value: 'SIDE_PANEL' as const, label: t`Side panel` },
              { value: 'DIALOG' as const, label: t`Centered dialog` },
            ]}
            fullWidth
          />
          {error && <div role="alert">{t`Could not load form settings.`}</div>}
        </SidePanelGroup>
        <SidePanelGroup heading={t`Fields`}>
          {configurableRecordFormFields.map((recordFormField) => {
            const { fieldMetadataItem } = recordFormField;
            const isVisible = isRecordFormFieldVisible(recordFormField);

            return (
              <MenuItem
                key={fieldMetadataItem.id}
                LeftIcon={getIcon(fieldMetadataItem.icon)}
                withIconContainer
                text={fieldMetadataItem.label}
                contextualText={
                  isFieldTypeSupportedInSettings(fieldMetadataItem.type)
                    ? getSettingsFieldTypeConfig(fieldMetadataItem.type)?.label
                    : undefined
                }
                isIconDisplayedOnHoverOnly={false}
                onClick={() => handleToggleVisibility(recordFormField)}
                iconButtons={
                  <LightIconButton
                    aria-label={
                      isVisible
                        ? t`Hide ${fieldMetadataItem.label}`
                        : t`Show ${fieldMetadataItem.label}`
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleVisibility(recordFormField);
                    }}
                  >
                    {isVisible ? <IconEye /> : <IconEyeOff />}
                  </LightIconButton>
                }
              />
            );
          })}
        </SidePanelGroup>
      </StyledContent>
      <SidePanelFooter
        actions={[
          <Button
            key="cancel"
            size="sm"
            onClick={onClose ?? goBackFromSidePanel}
          >{t`Cancel`}</Button>,
          <Button
            key="save"
            size="sm"
            variant="solid"
            color="accent"
            loading={isSaving}
            onClick={handleSave}
          >{t`Save`}</Button>,
        ]}
      />
    </StyledContainer>
  );
};
