import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
  type RecordFormPresentation,
  type RecordFormStep,
} from '@/object-record/record-form/types/RecordFormSettings';
import { createRequiredContext } from '~/utils/createRequiredContext';

export type RecordCreationFormContextValue = {
  requestRecordCreation: (params: {
    objectMetadataItem: EnrichedObjectMetadataItem;
    initialDraftRecord?: Partial<ObjectRecord>;
    presentation?: RecordFormPresentation;
    mode?: 'create' | 'edit';
    steps?: RecordFormStep[] | null;
    createRecord: (draftRecord: Partial<ObjectRecord>) => Promise<ObjectRecord>;
  }) => Promise<ObjectRecord | null>;
  settleRecordCreationDraft: (params: {
    requestId: string;
    draftRecord: Partial<ObjectRecord> | null;
  }) => Promise<{ error?: unknown }>;
};

export const [
  RecordCreationFormContextProvider,
  useRecordCreationFormContextOrThrow,
] = createRequiredContext<RecordCreationFormContextValue>(
  'RecordCreationFormContext',
);
