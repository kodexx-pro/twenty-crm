import { type RecordFormField } from '@/object-record/record-form/types/RecordFormField';
import { type RecordFormStep } from '@/object-record/record-form/types/RecordFormSettings';

const DEFAULT_FIELDS_PER_STEP = 6;

export const computeRecordFormSteps = <
  TField extends RecordFormField<{ id: string }>,
>({
  recordFormFields,
  configuredSteps,
}: {
  recordFormFields: TField[];
  configuredSteps?: RecordFormStep[] | null;
}): { title: string | null; fields: TField[] }[] => {
  const assignedFieldMetadataIds = new Set<string>();
  const steps: { title: string | null; fields: TField[] }[] = (
    configuredSteps ?? []
  ).map((step) => ({
    title: step.title,
    fields: recordFormFields.filter(({ fieldMetadataItem }) => {
      if (
        !step.fieldMetadataIds.includes(fieldMetadataItem.id) ||
        assignedFieldMetadataIds.has(fieldMetadataItem.id)
      )
        return false;
      assignedFieldMetadataIds.add(fieldMetadataItem.id);
      return true;
    }),
  }));
  if (steps.length > 0) {
    steps[steps.length - 1].fields.push(
      ...recordFormFields.filter(
        (field) => !assignedFieldMetadataIds.has(field.fieldMetadataItem.id),
      ),
    );
    const nonEmptySteps = steps.filter((step) =>
      step.fields.some((field) => field.isVisible),
    );
    if (nonEmptySteps.length === 0)
      return [
        { title: steps[steps.length - 1].title, fields: recordFormFields },
      ];
    const orphanedFields = recordFormFields.filter(
      (field) => !nonEmptySteps.some((step) => step.fields.includes(field)),
    );
    nonEmptySteps[nonEmptySteps.length - 1].fields.push(...orphanedFields);
    return nonEmptySteps;
  }
  // Fields added since the layout was configured must remain reachable.
  const visibleFields = recordFormFields.filter((field) => field.isVisible);
  const hiddenFields = recordFormFields.filter((field) => !field.isVisible);
  for (
    let index = 0;
    index < visibleFields.length;
    index += DEFAULT_FIELDS_PER_STEP
  ) {
    steps.push({
      title: null,
      fields: visibleFields.slice(index, index + DEFAULT_FIELDS_PER_STEP),
    });
  }
  if (steps.length === 0) steps.push({ title: null, fields: [] });
  steps[steps.length - 1].fields.push(...hiddenFields);
  return steps;
};
