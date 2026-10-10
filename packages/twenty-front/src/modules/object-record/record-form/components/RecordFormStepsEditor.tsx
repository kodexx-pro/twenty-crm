import { type RecordFormField } from '@/object-record/record-form/types/RecordFormField';
import { type RecordFormStep } from '@/object-record/record-form/types/RecordFormSettings';
import { Select } from '@/ui/input/components/Select';
import { TextInput } from '@/ui/input/components/TextInput';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

const StyledEditor = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

type RecordFormStepsEditorProps = {
  steps: RecordFormStep[];
  fields: RecordFormField[];
  disabled: boolean;
  onChange: (steps: RecordFormStep[]) => void;
};

export const RecordFormStepsEditor = ({
  steps,
  fields,
  disabled,
  onChange,
}: RecordFormStepsEditorProps) => (
  <StyledEditor>
    {steps.length === 0 && (
      <div>{t`Fields are grouped automatically in steps of up to six visible fields. Add steps to choose your own groups.`}</div>
    )}
    {steps.map((step, index) => (
      <StyledEditor key={index}>
        <TextInput
          label={t`Step ${index + 1} title`}
          value={step.title}
          disabled={disabled}
          maxLength={100}
          fullWidth
          onChange={(title) =>
            onChange(
              steps.map((candidate, candidateIndex) =>
                candidateIndex === index ? { ...candidate, title } : candidate,
              ),
            )
          }
        />
        <Button
          size="sm"
          disabled={disabled}
          onClick={() =>
            onChange(
              steps.filter((_, candidateIndex) => candidateIndex !== index),
            )
          }
        >{t`Remove step ${index + 1}`}</Button>
      </StyledEditor>
    ))}
    <Button
      size="sm"
      disabled={disabled || steps.length >= 20}
      onClick={() =>
        onChange([
          ...steps,
          { title: t`Step ${steps.length + 1}`, fieldMetadataIds: [] },
        ])
      }
    >{t`Add step`}</Button>
    {steps.length > 0 &&
      fields.map(({ fieldMetadataItem }) => (
        <Select
          key={fieldMetadataItem.id}
          dropdownId={`record-form-step-${fieldMetadataItem.id}`}
          label={fieldMetadataItem.label}
          disabled={disabled}
          fullWidth
          value={String(
            steps.findIndex((step) =>
              step.fieldMetadataIds.includes(fieldMetadataItem.id),
            ),
          )}
          options={[
            { value: '-1', label: t`Last step (automatic)` },
            ...steps.map((step, index) => ({
              value: String(index),
              label: step.title || t`Step ${index + 1}`,
            })),
          ]}
          onChange={(value) =>
            onChange(
              steps.map((step, index) => ({
                ...step,
                fieldMetadataIds: [
                  ...step.fieldMetadataIds.filter(
                    (id) => id !== fieldMetadataItem.id,
                  ),
                  ...(String(index) === value ? [fieldMetadataItem.id] : []),
                ],
              })),
            )
          }
        />
      ))}
  </StyledEditor>
);
