import { gql } from '@apollo/client';

export const RECORD_FORM_SETTINGS = gql`
  query RecordFormSettings($objectMetadataId: UUID!) {
    workspace: recordFormSettings {
      presentation
    }
    object: recordFormSettings(objectMetadataId: $objectMetadataId) {
      presentation
      steps {
        title
        fieldMetadataIds
      }
    }
  }
`;

export const UPDATE_RECORD_FORM_SETTINGS = gql`
  mutation UpdateRecordFormSettings($input: UpdateRecordFormSettingsInput!) {
    updateRecordFormSettings(input: $input) {
      presentation
      steps {
        title
        fieldMetadataIds
      }
    }
  }
`;
