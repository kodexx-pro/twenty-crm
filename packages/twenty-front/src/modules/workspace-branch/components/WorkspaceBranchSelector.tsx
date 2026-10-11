import { Select } from '@/ui/input/components/Select';
import { useWorkspaceBranches } from '@/workspace-branch/hooks/useWorkspaceBranches';
import { writeWorkspaceBranchSelection } from '@/workspace-branch/utils/workspaceBranchSelection';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme';

const StyledContainer = styled.div`
  padding: ${themeCssVariables.spacing[2]};
`;

export const WorkspaceBranchSelector = () => {
  const { enabled, branches, workspaceId, selectedBranchId } =
    useWorkspaceBranches();
  const [error, setError] = useState<string | null>(null);
  if (!enabled || !workspaceId) return null;

  return (
    <StyledContainer>
      {branches.length === 0 ? (
        <div role="status">{t`No branch access. Contact your administrator.`}</div>
      ) : (
        <Select
          dropdownId="workspace-branch-selector"
          label={t`Branch`}
          fullWidth
          value={selectedBranchId ?? 'all'}
          options={[
            ...(branches.length > 1
              ? [{ value: 'all', label: t`All permitted branches` }]
              : []),
            ...branches.map((branch) => ({
              value: branch.id,
              label: branch.name,
            })),
          ]}
          onChange={(branchId) => {
            try {
              writeWorkspaceBranchSelection(workspaceId, branchId);
              // Reload resets every record store and both Apollo caches before switching scope.
              window.location.reload();
            } catch {
              setError(
                t`Unable to switch branches. Allow browser storage and try again.`,
              );
            }
          }}
        />
      )}
      {error && <div role="alert">{error}</div>}
    </StyledContainer>
  );
};
