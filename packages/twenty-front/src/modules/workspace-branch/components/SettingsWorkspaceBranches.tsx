import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersState';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { Select } from '@/ui/input/components/Select';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import {
  WORKSPACE_BRANCH_ACCESS,
  UPDATE_WORKSPACE_BRANCH_ACCESS,
  PREPARE_WORKSPACE_BRANCHES,
} from '@/workspace-branch/graphql/workspaceBranchAccess';
import {
  type WorkspaceBranchAccess,
  type WorkspaceBranchOperation,
} from '@/workspace-branch/types/WorkspaceBranch';
import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { Section } from 'twenty-ui/components/layout';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';
import { PermissionFlagType } from '~/generated-metadata/graphql';
import { v4 } from 'uuid';

const StyledStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;
const StyledRow = styled.div`
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  > :first-child {
    flex: 1;
    min-width: 160px;
  }
`;
const StyledOperations = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  input {
    accent-color: ${themeCssVariables.color.green};
  }
`;

const OPERATIONS: WorkspaceBranchOperation[] = [
  'read',
  'create',
  'update',
  'delete',
  'restore',
];

export const SettingsWorkspaceBranches = () => {
  const allowed = useHasPermissionFlag(PermissionFlagType.ROLES);
  const { data, loading, error, refetch } = useQuery<{
    workspaceBranchAccess: WorkspaceBranchAccess;
  }>(WORKSPACE_BRANCH_ACCESS, { skip: !allowed, fetchPolicy: 'network-only' });
  if (!allowed) return null;
  return (
    <Section.Root>
      <Section.Header
        title={t`Branches`}
        description={t`Optional isolation for all business records, including clients and contacts. Existing object permissions still apply.`}
      />
      {loading && <div role="status">{t`Loading branches…`}</div>}
      {error && (
        <div role="alert">
          {t`Unable to load branches.`}{' '}
          <Button size="sm" onClick={() => refetch()}>{t`Try again`}</Button>
        </div>
      )}
      {data && (
        <WorkspaceBranchesEditor
          key={data.workspaceBranchAccess.revision}
          access={data.workspaceBranchAccess}
          onSaved={() => refetch()}
        />
      )}
    </Section.Root>
  );
};

const WorkspaceBranchesEditor = ({
  access,
  onSaved,
}: {
  access: WorkspaceBranchAccess;
  onSaved: () => Promise<unknown>;
}) => {
  const currentWorkspaceMembers = useAtomStateValue(
    currentWorkspaceMembersState,
  );
  const [draft, setDraft] = useState(access);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [assignmentBranchId, setAssignmentBranchId] = useState('');
  const [assignmentAcknowledged, setAssignmentAcknowledged] = useState(false);
  const [prepared, setPrepared] = useState<{
    objectsPrepared: number;
    recordsAssigned: number;
  } | null>(null);
  const [prepare, { loading: preparing }] = useMutation<{
    prepareWorkspaceBranches: {
      objectsPrepared: number;
      recordsAssigned: number;
    };
  }>(PREPARE_WORKSPACE_BRANCHES);
  const [update, { loading }] = useMutation(UPDATE_WORKSPACE_BRANCH_ACCESS);
  const operationLabels = {
    read: t`Read`,
    create: t`Create`,
    update: t`Update`,
    delete: t`Delete`,
    restore: t`Restore`,
    transfer: t`Transfer`,
  };
  const canSave =
    draft.branches.every((branch) => branch.name.trim().length > 0) &&
    draft.grants.every((grant) => grant.principalId && grant.branchId);

  return (
    <StyledStack>
      <label>
        <input
          type="checkbox"
          checked={draft.enabled}
          disabled={loading}
          onChange={(event) =>
            setDraft({ ...draft, enabled: event.target.checked })
          }
        />{' '}
        {t`Isolate records by branch`}
      </label>
      <div>{t`Keep this disabled to use the current shared workspace. Activation requires every existing record to be classified and validated by the server.`}</div>
      {draft.branches.map((branch, index) => (
        <StyledRow key={branch.id}>
          <SettingsTextInput
            instanceId={`branch-name-${branch.id}`}
            label={t`Branch name`}
            maxLength={100}
            value={branch.name}
            disabled={loading}
            fullWidth
            onChange={(name) =>
              setDraft({
                ...draft,
                branches: draft.branches.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, name } : item,
                ),
              })
            }
          />
          <label>
            <input
              type="checkbox"
              disabled={loading}
              checked={branch.isActive}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  branches: draft.branches.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, isActive: event.target.checked }
                      : item,
                  ),
                })
              }
            />{' '}
            {t`Active`}
          </label>
        </StyledRow>
      ))}
      <Button
        size="sm"
        disabled={loading || draft.branches.length >= 200}
        onClick={() =>
          setDraft({
            ...draft,
            branches: [
              ...draft.branches,
              { id: v4(), name: '', isActive: true },
            ],
          })
        }
      >{t`Add branch`}</Button>
      <Section.Header
        title={t`Branch permissions`}
        description={t`No permission is granted automatically. Deactivating a branch suspends access while preserving its records.`}
      />
      <div>{t`Moving existing records between branches is not available yet.`}</div>
      {draft.grants.map((grant, index) => (
        <StyledStack key={`${grant.principalType}-${index}`}>
          <StyledRow>
            {grant.principalType === 'workspaceMember' ? (
              <Select
                dropdownId={`branch-member-${index}`}
                label={t`Employee`}
                value={grant.principalId}
                disabled={loading}
                emptyOption={{ value: '', label: t`Select an employee` }}
                options={currentWorkspaceMembers.map((member) => ({
                  value: member.id,
                  label:
                    `${member.name.firstName} ${member.name.lastName}`.trim() ||
                    member.userEmail,
                }))}
                onChange={(principalId) =>
                  setDraft({
                    ...draft,
                    grants: draft.grants.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, principalId } : item,
                    ),
                  })
                }
              />
            ) : (
              <div>
                {grant.principalType}: {grant.principalId}
              </div>
            )}
            <Select
              dropdownId={`branch-grant-${index}`}
              label={t`Branch`}
              value={grant.branchId}
              disabled={loading}
              emptyOption={{ value: '', label: t`Select a branch` }}
              options={draft.branches.map((branch) => ({
                value: branch.id,
                label: branch.name || t`Unnamed branch`,
              }))}
              onChange={(branchId) =>
                setDraft({
                  ...draft,
                  grants: draft.grants.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, branchId } : item,
                  ),
                })
              }
            />
            <Button
              size="sm"
              disabled={loading}
              onClick={() =>
                setDraft({
                  ...draft,
                  grants: draft.grants.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            >{t`Remove permission`}</Button>
          </StyledRow>
          <StyledOperations>
            {OPERATIONS.map((operation) => (
              <label key={operation}>
                <input
                  type="checkbox"
                  disabled={loading}
                  checked={grant.operations.includes(operation)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      grants: draft.grants.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              operations: event.target.checked
                                ? [...item.operations, operation]
                                : item.operations.filter(
                                    (value) => value !== operation,
                                  ),
                            }
                          : item,
                      ),
                    })
                  }
                />{' '}
                {operationLabels[operation]}
              </label>
            ))}
          </StyledOperations>
        </StyledStack>
      ))}
      <Button
        size="sm"
        disabled={loading || draft.branches.length === 0}
        onClick={() =>
          setDraft({
            ...draft,
            grants: [
              ...draft.grants,
              {
                principalType: 'workspaceMember',
                principalId: '',
                branchId: '',
                operations: ['read'],
              },
            ],
          })
        }
      >{t`Add employee permission`}</Button>
      <Section.Header title={t`Object structure`} description={t`Prepare protected branch fields and indexes for new objects without assigning records or disabling isolation.`} />
      <Button size="sm" disabled={loading} loading={preparing} onClick={async () => {
        setError(null);
        try {
          const result = await prepare({ variables: {} });
          if (result.error) throw result.error;
          if (result.data) setPrepared(result.data.prepareWorkspaceBranches);
        } catch (prepareError) {
          setError(prepareError instanceof Error ? prepareError.message : t`Unable to prepare object structure.`);
        }
      }}>{t`Prepare object structure`}</Button>
      {!access.enabled && (
        <StyledStack>
          <Section.Header
            title={t`Existing records`}
            description={t`Save your branches first. This assigns every unclassified business record to the chosen branch; records already assigned keep their branch.`}
          />
          <Select
            dropdownId="branch-existing-record-assignment"
            label={t`Destination branch`}
            value={assignmentBranchId}
            disabled={loading || preparing}
            emptyOption={{ value: '', label: t`Select a saved branch` }}
            options={access.branches
              .filter((branch) => branch.isActive)
              .map((branch) => ({ value: branch.id, label: branch.name }))}
            onChange={(value) => {
              setAssignmentBranchId(value);
              setAssignmentAcknowledged(false);
            }}
          />
          <label>
            <input
              type="checkbox"
              disabled={loading || preparing || !assignmentBranchId}
              checked={assignmentAcknowledged}
              onChange={(event) =>
                setAssignmentAcknowledged(event.target.checked)
              }
            />{' '}
            {t`Assign all unclassified existing records to this branch.`}
          </label>
          <Button
            size="sm"
            disabled={!assignmentBranchId || !assignmentAcknowledged || loading}
            loading={preparing}
            onClick={async () => {
              setError(null);
              try {
                const result = await prepare({
                  variables: { branchId: assignmentBranchId },
                });
                if (result.error) throw result.error;
                if (result.data)
                  setPrepared(result.data.prepareWorkspaceBranches);
              } catch (prepareError) {
                setError(
                  prepareError instanceof Error
                    ? prepareError.message
                    : t`Unable to prepare existing records.`,
                );
              }
            }}
          >{t`Prepare existing records`}</Button>
        </StyledStack>
      )}
      {prepared && <div role="status">{t`${prepared.objectsPrepared} objects prepared; ${prepared.recordsAssigned} records assigned.`}</div>}
      {error && <div role="alert">{error}</div>}
      {saved && <div role="status">{t`Branch settings saved.`}</div>}
      <Button
        size="sm"
        variant="solid"
        color="accent"
        disabled={!canSave || preparing}
        loading={loading}
        onClick={async () => {
          setError(null);
          setSaved(false);
          try {
            const result = await update({
              variables: {
                input: {
                  expectedRevision: access.revision,
                  enabled: draft.enabled,
                  branches: draft.branches.map(({ id, name, isActive }) => ({
                    id,
                    name: name.trim(),
                    isActive,
                  })),
                  grants: draft.grants.map(
                    ({ principalType, principalId, branchId, operations }) => ({
                      principalType,
                      principalId,
                      branchId,
                      operations,
                    }),
                  ),
                },
              },
            });
            if (result.error) throw result.error;
            setSaved(true);
            await onSaved();
          } catch (saveError) {
            setError(
              saveError instanceof Error
                ? saveError.message
                : t`Unable to save branch settings. Reload and try again.`,
            );
          }
        }}
      >{t`Save branches`}</Button>
    </StyledStack>
  );
};
