import {
  RECORD_FORM_SETTINGS,
  UPDATE_RECORD_FORM_SETTINGS,
} from '@/object-record/record-form/graphql/recordFormSettings';
import { type RecordFormSettings } from '@/object-record/record-form/types/RecordFormSettings';
import { useMutation, useQuery } from '@apollo/client/react';

export const useRecordFormSettings = (
  objectMetadataId: string,
  skip = false,
) => {
  const { data, loading, error, refetch } = useQuery<{
    workspace: RecordFormSettings;
    object: RecordFormSettings;
  }>(RECORD_FORM_SETTINGS, { variables: { objectMetadataId }, skip });
  const [updateSettings] = useMutation(UPDATE_RECORD_FORM_SETTINGS);

  const saveSettings = async (
    settings: RecordFormSettings,
    isWorkspaceDefault = false,
  ) => {
    await updateSettings({
      variables: {
        input: {
          objectMetadataId: isWorkspaceDefault ? null : objectMetadataId,
          ...settings,
          ...(settings.steps !== undefined
            ? {
                steps:
                  settings.steps?.map(({ title, fieldMetadataIds }) => ({
                    title,
                    fieldMetadataIds,
                  })) ?? null,
              }
            : {}),
        },
      },
    });
    await refetch();
  };

  return {
    presentation:
      data?.object.presentation ?? data?.workspace.presentation ?? 'SIDE_PANEL',
    objectSettings: data?.object,
    workspaceSettings: data?.workspace,
    loading,
    error,
    loadSettings: async () => {
      const response = await refetch();
      return response.data;
    },
    saveSettings,
  };
};
