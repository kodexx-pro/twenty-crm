import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { isDeeplyEqual } from '~/utils/isDeeplyEqual';
import { ObjectMetadataIcon } from '@/object-metadata/components/ObjectMetadataIcon';
import { HeaderIdentifier } from '@/ui/layout/page/components/HeaderIdentifier';
import { PageCardHeader } from '@/ui/layout/page/components/PageCardHeader';
import { SIDE_PANEL_FOCUS_ID } from '@/side-panel/constants/SidePanelFocusId';
import { currentFocusIdSelector } from '@/ui/utilities/focus/states/currentFocusIdSelector';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { getFieldPermissions } from '@/object-metadata/utils/getFieldPermissions';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { RecordFormFieldInputs } from '@/object-record/record-form/components/RecordFormFieldInputs';
import { useRecordCreationFormSettle } from '@/object-record/record-form/hooks/useRecordCreationFormSettle';
import { useRecordFormFields } from '@/object-record/record-form/hooks/useRecordFormFields';
import { computeRecordFormCreateRecordInput } from '@/object-record/record-form/utils/computeRecordFormCreateRecordInput';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { useOpenRecordCreationFormSettingsInSidePanel } from '@/side-panel/hooks/useOpenRecordCreationFormSettingsInSidePanel';
import { recordCreationFormAreHiddenFieldsShownComponentState } from '@/side-panel/pages/record-creation-form/states/recordCreationFormAreHiddenFieldsShownComponentState';
import { recordCreationFormDraftComponentState } from '@/side-panel/pages/record-creation-form/states/recordCreationFormDraftComponentState';
import { recordCreationFormRequestComponentState } from '@/side-panel/pages/record-creation-form/states/recordCreationFormRequestComponentState';
import { SidePanelFooter } from '@/ui/layout/side-panel/components/SidePanelFooter';
import { useValidationRules } from '@/validation-rules/hooks/useValidationRules';
import { type ValidationRuleViolation } from '@/validation-rules/types/ValidationRuleViolation';
import { buildValidationRuleFieldDescriptors } from '@/validation-rules/utils/buildValidationRuleFieldDescriptors';
import { computeDraftValidationRuleViolations } from '@/validation-rules/utils/computeDraftValidationRuleViolations';
import { getValidationRuleViolationsFromError } from '@/validation-rules/utils/getValidationRuleViolationsFromError';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useState } from 'react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Key } from 'ts-key-enum';
import { type JsonValue } from 'type-fest';
import { PermissionFlagType } from 'twenty-shared/constants';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components/feedback';
import { LightButton } from 'twenty-ui/components/input';
import { IconChevronDown, IconChevronUp, IconPlus } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';
import { useTheme, themeCssVariables } from 'twenty-ui/theme';
import { computeRecordFormSteps } from '@/object-record/record-form/utils/computeRecordFormSteps';
import { type RecordFormStep } from '@/object-record/record-form/types/RecordFormSettings';
import { Select } from '@/ui/input/components/Select';
import { useWorkspaceBranches } from '@/workspace-branch/hooks/useWorkspaceBranches';
import { resolveRecordFormBranch } from '@/workspace-branch/utils/resolveRecordFormBranch';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const StyledValidationRuleError = styled.div`
  background: ${themeCssVariables.background.danger};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledValidationRuleErrors = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  max-height: 30%;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledHiddenFieldsToggle = styled.div`
  display: flex;
`;

export const SidePanelRecordCreationFormPage = ({
  onEditSettings,
  onCancel,
}: { onEditSettings?: () => void; onCancel?: () => void } = {}) => {
  const recordCreationFormRequest = useAtomComponentStateValue(
    recordCreationFormRequestComponentState,
  );

  if (!isDefined(recordCreationFormRequest)) {
    return null;
  }

  return (
    <SidePanelRecordCreationForm
      requestId={recordCreationFormRequest.requestId}
      objectMetadataId={recordCreationFormRequest.objectMetadataId}
      initialDraftRecord={recordCreationFormRequest.initialDraftRecord}
      mode={recordCreationFormRequest.mode ?? 'create'}
      onEditSettings={onEditSettings}
      onCancel={onCancel}
      isWizard={recordCreationFormRequest.presentation === 'WIZARD'}
      configuredSteps={recordCreationFormRequest.steps}
    />
  );
};

const SidePanelRecordCreationForm = ({
  requestId,
  objectMetadataId,
  initialDraftRecord,
  mode,
  onEditSettings,
  onCancel,
  isWizard,
  configuredSteps,
}: {
  requestId: string;
  objectMetadataId: string;
  initialDraftRecord: Partial<ObjectRecord>;
  mode: 'create' | 'edit';
  onEditSettings?: () => void;
  onCancel?: () => void;
  isWizard: boolean;
  configuredSteps?: RecordFormStep[] | null;
}) => {
  const { objectMetadataItem } = useObjectMetadataItemById({
    objectId: objectMetadataId,
  });

  const { objectMetadataItems } = useObjectMetadataItems();
  const branchAccess = useWorkspaceBranches();
  const [chosenBranchId, setChosenBranchId] = useState<string | null>(null);
  const hasBranchField = objectMetadataItem.fields.some(
    (field) => field.name === 'branchId' && field.isSystem,
  );
  const isBranchScoped = branchAccess.enabled && hasBranchField;
  const branchId = resolveRecordFormBranch({
    enabled: isBranchScoped,
    mode,
    existingBranchId: initialDraftRecord.branchId,
    selectedBranchId: chosenBranchId ?? branchAccess.selectedBranchId,
    branches: branchAccess.branches,
  });
  const theme = useTheme();

  const { settleRecordCreationDraft } = useRecordCreationFormSettle();
  const { enqueueToast } = useToast();

  const [recordCreationFormDraft, setRecordCreationFormDraft] =
    useAtomComponentState(recordCreationFormDraftComponentState);

  const [
    recordCreationFormAreHiddenFieldsShown,
    setRecordCreationFormAreHiddenFieldsShown,
  ] = useAtomComponentState(
    recordCreationFormAreHiddenFieldsShownComponentState,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [draftValidationRuleViolations, setDraftValidationRuleViolations] =
    useState<ValidationRuleViolation[]>([]);
  const [serverValidationRuleViolations, setServerValidationRuleViolations] =
    useState<ValidationRuleViolation[]>([]);

  const { validationRules } = useValidationRules({ objectMetadataId });
  const currentFocusId = useAtomStateValue(currentFocusIdSelector);

  const draftRecord = recordCreationFormDraft ?? initialDraftRecord;

  const hasLayoutsPermission = useHasPermissionFlag(PermissionFlagType.LAYOUTS);

  const { openRecordCreationFormSettingsInSidePanel } =
    useOpenRecordCreationFormSettingsInSidePanel();

  const { recordFormFields } = useRecordFormFields({ objectMetadataItem });
  const objectPermissions = useObjectPermissionsForObject(
    objectMetadataItem.id,
  );

  const editableRecordFormFields = recordFormFields.filter(
    ({ fieldMetadataItem }) =>
      !(fieldMetadataItem.name === 'branchId' && fieldMetadataItem.isSystem) &&
      getFieldPermissions({
        objectPermissions,
        fieldMetadataId: fieldMetadataItem.id,
      }).canUpdateField,
  );

  const visibleFieldMetadataItems = editableRecordFormFields
    .filter((recordFormField) => recordFormField.isVisible)
    .map((recordFormField) => recordFormField.fieldMetadataItem);

  const hiddenFieldMetadataItems = editableRecordFormFields
    .filter((recordFormField) => !recordFormField.isVisible)
    .map((recordFormField) => recordFormField.fieldMetadataItem);

  const steps = computeRecordFormSteps({
    recordFormFields: editableRecordFormFields,
    configuredSteps,
  });
  const currentStepIndex = Math.min(activeStepIndex, steps.length - 1);
  const currentStep = steps[currentStepIndex];
  const isLastStep = !isWizard || currentStepIndex === steps.length - 1;
  const currentStepFieldMetadataIds = new Set(
    currentStep.fields.map((field) => field.fieldMetadataItem.id),
  );
  const renderedVisibleFieldMetadataItems = isWizard
    ? visibleFieldMetadataItems.filter((field) =>
        currentStepFieldMetadataIds.has(field.id),
      )
    : visibleFieldMetadataItems;
  const renderedHiddenFieldMetadataItems = isWizard
    ? hiddenFieldMetadataItems.filter((field) =>
        currentStepFieldMetadataIds.has(field.id),
      )
    : hiddenFieldMetadataItems;
  const hiddenFieldsCount = renderedHiddenFieldMetadataItems.length;

  const validationRuleViolations = [
    ...draftValidationRuleViolations,
    ...serverValidationRuleViolations,
  ];

  const computeViolations = (draftRecordToCheck: Partial<ObjectRecord>) =>
    computeDraftValidationRuleViolations({
      validationRules,
      draftRecord: draftRecordToCheck,
      fields: buildValidationRuleFieldDescriptors({
        objectMetadataItem,
        objectMetadataItems,
      }),
      fieldMetadataItems: objectMetadataItem.fields,
      now: new Date().toISOString(),
    });

  const updateDraftRecord = (gqlFieldName: string, value: JsonValue) => {
    setRecordCreationFormDraft((previousDraftRecord) => ({
      ...(previousDraftRecord ?? initialDraftRecord),
      [gqlFieldName]: value,
    }));

    if (draftValidationRuleViolations.length > 0) {
      setDraftValidationRuleViolations(
        computeViolations({ ...draftRecord, [gqlFieldName]: value }),
      );
    }
  };

  const handleFieldValueChange = (gqlFieldName: string, value: JsonValue) => {
    updateDraftRecord(gqlFieldName, value);
  };

  const handleFieldValueClear = (gqlFieldName: string) => {
    updateDraftRecord(gqlFieldName, null);
  };

  const revealHiddenFieldsIfTargeted = (
    targetedFieldMetadataIds: (string | null)[],
  ) => {
    if (isWizard) {
      const targetedStepIndex = steps.findIndex((step) =>
        step.fields.some((field) =>
          targetedFieldMetadataIds.includes(field.fieldMetadataItem.id),
        ),
      );
      if (targetedStepIndex >= 0) setActiveStepIndex(targetedStepIndex);
    }
    const isAnyHiddenFieldTargeted = hiddenFieldMetadataItems.some(
      (fieldMetadataItem) =>
        targetedFieldMetadataIds.includes(fieldMetadataItem.id),
    );

    if (isAnyHiddenFieldTargeted) {
      setRecordCreationFormAreHiddenFieldsShown(true);
    }
  };

  const handleNextClick = () => {
    if (isSubmitting) return;
    const currentStepViolations = computeViolations(draftRecord).filter(
      (violation) =>
        isDefined(violation.fieldMetadataId) &&
        currentStepFieldMetadataIds.has(violation.fieldMetadataId),
    );
    setServerValidationRuleViolations([]);
    setDraftValidationRuleViolations(currentStepViolations);
    if (currentStepViolations.length > 0) {
      revealHiddenFieldsIfTargeted(
        currentStepViolations.map((violation) => violation.fieldMetadataId),
      );
      return;
    }
    setActiveStepIndex(currentStepIndex + 1);
  };

  const handleCreateClick = async () => {
    if (isSubmitting || (isBranchScoped && !branchId)) {
      return;
    }

    setServerValidationRuleViolations([]);

    if (validationRules.length > 0) {
      const draftViolations = computeViolations(draftRecord);

      setDraftValidationRuleViolations(draftViolations);

      revealHiddenFieldsIfTargeted(
        draftViolations.map((violation) => violation.fieldMetadataId),
      );

      if (draftViolations.length > 0) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { error } = await settleRecordCreationDraft({
        requestId,
        draftRecord: computeRecordFormCreateRecordInput({
          draftRecord:
            mode === 'edit'
              ? Object.fromEntries(
                  Object.entries(draftRecord).filter(
                    ([fieldName, value]) =>
                      !isDeeplyEqual(value, initialDraftRecord[fieldName], {
                        strict: true,
                      }),
                  ),
                )
              : { ...draftRecord, ...(isBranchScoped ? { branchId } : {}) },
          fieldMetadataItems: objectMetadataItem.fields,
          objectMetadataItems,
          isForUpdate: mode === 'edit',
        }),
      });

      if (!isDefined(error)) {
        return;
      }

      const serverViolations = getValidationRuleViolationsFromError(error);

      setServerValidationRuleViolations(serverViolations);

      if (serverViolations.length === 0) {
        enqueueToast(getToastOptionsFromError({ error }));
        return;
      }

      revealHiddenFieldsIfTargeted(
        serverViolations.map((violation) => violation.fieldMetadataId),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerRef = useHotkeysOnFocusedElement({
    keys: [`${Key.Meta}+${Key.Enter}`, `${Key.Control}+${Key.Enter}`],
    focusId: currentFocusId ?? SIDE_PANEL_FOCUS_ID,
    callback: isLastStep ? handleCreateClick : handleNextClick,
    dependencies: [
      currentFocusId,
      handleCreateClick,
      handleNextClick,
      isLastStep,
    ],
  });

  return (
    <StyledContainer ref={containerRef}>
      <PageCardHeader
        title={
          <HeaderIdentifier
            icon={
              <ObjectMetadataIcon
                objectMetadataItem={objectMetadataItem}
                size={theme.icon.size.md}
                stroke={theme.icon.stroke.sm}
              />
            }
            title={
              mode === 'edit'
                ? t`Edit ${objectMetadataItem.labelSingular}`
                : t`Create ${objectMetadataItem.labelSingular}`
            }
          />
        }
      />
      <StyledContent>
        {isBranchScoped &&
          (mode === 'edit' ? (
            <div>
              {t`Branch`}:{' '}
              {branchAccess.branches.find((branch) => branch.id === branchId)
                ?.name ?? t`Unavailable branch`}
            </div>
          ) : (
            <Select
              dropdownId={`record-form-branch-${requestId}`}
              label={t`Branch`}
              description={t`Choose the branch that owns this record.`}
              fullWidth
              value={branchId ?? ''}
              disabled={isSubmitting}
              emptyOption={{ value: '', label: t`Select a branch` }}
              options={branchAccess.branches
                .filter((branch) => branch.operations?.includes('create'))
                .map((branch) => ({ value: branch.id, label: branch.name }))}
              onChange={setChosenBranchId}
            />
          ))}
        {isWizard && (
          <div role="status" aria-live="polite">
            {t`Step ${currentStepIndex + 1} of ${steps.length}`}
            {currentStep.title ? `: ${currentStep.title}` : ''}
          </div>
        )}
        <RecordFormFieldInputs
          objectMetadataItem={objectMetadataItem}
          fieldMetadataItems={renderedVisibleFieldMetadataItems}
          draftRecord={draftRecord}
          onFieldValueChange={handleFieldValueChange}
          onFieldValueClear={handleFieldValueClear}
        />
        {hiddenFieldsCount > 0 && (
          <StyledHiddenFieldsToggle>
            <LightButton
              startIcon={
                recordCreationFormAreHiddenFieldsShown ? (
                  <IconChevronUp />
                ) : (
                  <IconChevronDown />
                )
              }
              onClick={() =>
                setRecordCreationFormAreHiddenFieldsShown(
                  !recordCreationFormAreHiddenFieldsShown,
                )
              }
            >
              {recordCreationFormAreHiddenFieldsShown
                ? t`Collapse hidden fields`
                : t`Show hidden fields (${hiddenFieldsCount})`}
            </LightButton>
          </StyledHiddenFieldsToggle>
        )}
        {recordCreationFormAreHiddenFieldsShown && hiddenFieldsCount > 0 && (
          <RecordFormFieldInputs
            objectMetadataItem={objectMetadataItem}
            fieldMetadataItems={renderedHiddenFieldMetadataItems}
            draftRecord={draftRecord}
            onFieldValueChange={handleFieldValueChange}
            onFieldValueClear={handleFieldValueClear}
          />
        )}
      </StyledContent>
      {validationRuleViolations.length > 0 && (
        <StyledValidationRuleErrors>
          {validationRuleViolations.map((violation) => (
            <StyledValidationRuleError key={violation.ruleId} role="alert">
              {violation.message}
            </StyledValidationRuleError>
          ))}
        </StyledValidationRuleErrors>
      )}
      <SidePanelFooter
        actions={[
          ...(isWizard && currentStepIndex > 0
            ? [
                <Button
                  key="back"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => {
                    setActiveStepIndex(currentStepIndex - 1);
                    setDraftValidationRuleViolations([]);
                    setServerValidationRuleViolations([]);
                  }}
                >{t`Back`}</Button>,
              ]
            : []),
          ...(onCancel
            ? [
                <Button
                  key="cancel"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={onCancel}
                >{t`Cancel`}</Button>,
              ]
            : []),
          ...(hasLayoutsPermission
            ? [
                <Button
                  key="edit-form"
                  size="sm"
                  onClick={() =>
                    onEditSettings
                      ? onEditSettings()
                      : openRecordCreationFormSettingsInSidePanel(
                          objectMetadataItem,
                        )
                  }
                >{t`Edit`}</Button>,
              ]
            : []),
          <Button
            key="create-record"
            startIcon={isLastStep ? <IconPlus /> : undefined}
            size="sm"
            onClick={isLastStep ? handleCreateClick : handleNextClick}
            loading={isSubmitting}
            disabled={isBranchScoped && !branchId}
            shortcut={['Mod', 'Enter']}
            data-testid="record-creation-form-create-button"
            variant="solid"
            color="accent"
          >
            {!isLastStep ? t`Next` : mode === 'edit' ? t`Save` : t`Create`}
          </Button>,
        ]}
      />
    </StyledContainer>
  );
};
