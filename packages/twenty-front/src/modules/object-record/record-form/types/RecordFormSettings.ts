export type RecordFormPresentation = 'SIDE_PANEL' | 'DIALOG' | 'WIZARD';

export type RecordFormStep = {
  title: string;
  fieldMetadataIds: string[];
};

export type RecordFormSettings = {
  presentation: RecordFormPresentation | null;
  steps?: RecordFormStep[] | null;
};
