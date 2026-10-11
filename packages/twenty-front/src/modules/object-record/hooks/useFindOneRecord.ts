import { useQuery } from '@apollo/client/react';
import { useContext, useMemo } from 'react';
import { RecordFormBranchContext } from '@/workspace-branch/contexts/RecordFormBranchContext';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { type ObjectMetadataItemIdentifier } from '@/object-metadata/types/ObjectMetadataItemIdentifier';
import { getRecordFromRecordNode } from '@/object-record/cache/utils/getRecordFromRecordNode';
import { useGenerateDepthRecordGqlFieldsFromObject } from '@/object-record/graphql/record-gql-fields/hooks/useGenerateDepthRecordGqlFieldsFromObject';
import { type RecordGqlNode } from '@/object-record/graphql/types/RecordGqlNode';
import { useFindOneRecordQuery } from '@/object-record/hooks/useFindOneRecordQuery';
import { useCanReadObjectRecordsOrSharedRecords } from '@/object-record/record-sharing/hooks/useCanReadObjectRecordsOrSharedRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { type RecordGqlFields } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

export const useFindOneRecord = <T extends ObjectRecord = ObjectRecord>({
  objectNameSingular,
  objectRecordId = '',
  recordGqlFields,
  skip,
  withSoftDeleted = false,
}: ObjectMetadataItemIdentifier & {
  objectRecordId: string | undefined;
  recordGqlFields?: RecordGqlFields;
  skip?: boolean;
  withSoftDeleted?: boolean;
}) => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const { recordGqlFields: depthOneRecordGqlFields } =
    useGenerateDepthRecordGqlFieldsFromObject({
      objectNameSingular,
      depth: 1,
    });

  const apolloCoreClient = useApolloCoreClient();
  const recordFormBranch = useContext(RecordFormBranchContext);

  const computedRecordGqlFields = recordGqlFields ?? depthOneRecordGqlFields;

  const { findOneRecordQuery } = useFindOneRecordQuery({
    objectNameSingular,
    recordGqlFields: computedRecordGqlFields,
    withSoftDeleted,
  });

  const hasReadPermission =
    useCanReadObjectRecordsOrSharedRecords(objectMetadataItem);

  const { data, loading, error, refetch } = useQuery<{
    [nameSingular: string]: RecordGqlNode;
  }>(findOneRecordQuery, {
    skip:
      !isDefined(objectMetadataItem) ||
      !objectRecordId ||
      skip ||
      !hasReadPermission ||
      (recordFormBranch.enabled && !recordFormBranch.branchId),
    variables: { objectRecordId },
    client: apolloCoreClient,
    fetchPolicy: recordFormBranch.enabled ? 'no-cache' : undefined,
    context:
      recordFormBranch.enabled && recordFormBranch.branchId
        ? { headers: { 'x-workspace-branch-id': recordFormBranch.branchId } }
        : undefined,
  });

  // TODO: Remove connection from record
  const recordWithoutConnection = useMemo(
    () =>
      data?.[objectNameSingular]
        ? getRecordFromRecordNode<T>({
            recordNode: data?.[objectNameSingular],
          })
        : undefined,
    [data, objectNameSingular],
  );

  return {
    record: recordWithoutConnection,
    loading,
    error,
    refetch,
  };
};
