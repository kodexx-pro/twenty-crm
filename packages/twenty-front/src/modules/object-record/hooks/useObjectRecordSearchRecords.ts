import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { MAX_SEARCH_RESULTS } from '@/command-menu/constants/MaxSearchResults';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useDoObjectMetadataItemsExist } from '@/object-metadata/hooks/useDoObjectMetadataItemsExist';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { type WatchQueryFetchPolicy } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useContext, useMemo } from 'react';
import { RecordFormBranchContext } from '@/workspace-branch/contexts/RecordFormBranchContext';
import { isDefined } from 'twenty-shared/utils';
import {
  type ObjectRecordFilterInput,
  SearchDocument,
} from '~/generated/graphql';

// maybe we should look at ObjectMetadataItemIdentifier to update the API even though there are many location to update
type UseSearchRecordsParams = {
  objectNameSingulars: string[];
  limit?: number;
  onError?: (error?: Error) => void;
  skip?: boolean;
  fetchPolicy?: WatchQueryFetchPolicy;
  searchInput?: string;
  filter?: ObjectRecordFilterInput;
};

export const useObjectRecordSearchRecords = ({
  objectNameSingulars,
  searchInput,
  limit,
  skip,
  filter,
  fetchPolicy,
}: UseSearchRecordsParams) => {
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const areDefined = useDoObjectMetadataItemsExist(objectNameSingulars);

  const apolloCoreClient = useApolloCoreClient();
  const recordFormBranch = useContext(RecordFormBranchContext);

  const { data, loading, error, previousData } = useQuery(SearchDocument, {
    skip:
      skip ||
      !areDefined ||
      !currentWorkspaceMember ||
      !isDefined(searchInput) ||
      (recordFormBranch.enabled && !recordFormBranch.branchId),
    variables: {
      searchInput: searchInput ?? '',
      limit: limit ?? MAX_SEARCH_RESULTS,
      filter: filter ?? {},
      includedObjectNameSingulars: objectNameSingulars,
    },
    fetchPolicy: recordFormBranch.enabled ? 'no-cache' : fetchPolicy,
    context:
      recordFormBranch.enabled && recordFormBranch.branchId
        ? { headers: { 'x-workspace-branch-id': recordFormBranch.branchId } }
        : undefined,
    client: apolloCoreClient,
  });

  const effectiveData = loading
    ? recordFormBranch.enabled
      ? undefined
      : previousData
    : data;

  const searchRecords = useMemo(
    () => effectiveData?.search?.edges?.map((edge) => edge.node) || [],
    [effectiveData],
  );

  return {
    searchRecords,
    loading,
    error,
  };
};
