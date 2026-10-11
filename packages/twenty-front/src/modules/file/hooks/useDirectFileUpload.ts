import { putFileToUploadTarget } from '@/file/utils/putFileToUploadTarget';
import { RecordFormBranchContext } from '@/workspace-branch/contexts/RecordFormBranchContext';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { t } from '@lingui/core/macro';
import { useContext } from 'react';
import { isDefined } from 'twenty-shared/utils';
import {
  CompleteFileUploadDocument,
  CreateFileUploadDocument,
  type FileFolder,
  type FileWithSignedUrl,
} from '~/generated-metadata/graphql';

type DirectFileUploadOptions = {
  fileFolder: FileFolder;
  fieldMetadataId?: string;
  signal?: AbortSignal;
};

export const useDirectFileUpload = () => {
  const formBranch = useContext(RecordFormBranchContext);
  const apolloClient = useApolloClient();
  const [createFileUpload] = useMutation(CreateFileUploadDocument, {
    client: apolloClient,
  });
  const [completeFileUpload] = useMutation(CompleteFileUploadDocument, {
    client: apolloClient,
  });

  const createFileUploadAndPutFile = async (
    file: File,
    { fileFolder, fieldMetadataId, signal }: DirectFileUploadOptions,
  ): Promise<{ fileId: string }> => {
    if (formBranch.enabled && !formBranch.branchId) {
      throw new Error(t`Select a branch before uploading a file`);
    }

    const createResult = await createFileUpload({
      context: {
        headers: formBranch.enabled
          ? { 'x-workspace-branch-id': formBranch.branchId }
          : {},
      },
      variables: {
        filename: file.name,
        size: file.size,
        fileFolder,
        fieldMetadataId,
      },
    });

    const uploadTarget = createResult?.data?.createFileUpload;

    if (!isDefined(uploadTarget)) {
      throw new Error(t`Failed to initiate file upload`);
    }

    await putFileToUploadTarget({ file, uploadTarget, signal });

    return { fileId: uploadTarget.fileId };
  };

  const uploadFile = async (
    file: File,
    options: DirectFileUploadOptions,
  ): Promise<FileWithSignedUrl> => {
    const { fileId } = await createFileUploadAndPutFile(file, options);

    const completeResult = await completeFileUpload({
      variables: { fileId },
      context: {
        fetchOptions: { signal: options.signal },
        headers: formBranch.enabled
          ? { 'x-workspace-branch-id': formBranch.branchId }
          : {},
      },
    });

    const uploadedFile = completeResult?.data?.completeFileUpload;

    if (!isDefined(uploadedFile)) {
      throw new Error(t`Failed to finalize file upload`);
    }

    return uploadedFile;
  };

  return { uploadFile, createFileUploadAndPutFile };
};
