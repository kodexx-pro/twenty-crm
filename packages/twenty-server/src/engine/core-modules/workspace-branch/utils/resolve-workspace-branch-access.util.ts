import {
  type WorkspaceBranchAccess,
  type WorkspaceBranchAccessConfiguration,
  type WorkspaceBranchOperation,
  type WorkspaceBranchPrincipal,
} from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';

export const resolveWorkspaceBranchAccess = ({
  configuration,
  workspaceId,
  principal,
  operation,
}: {
  configuration: WorkspaceBranchAccessConfiguration;
  workspaceId: string;
  principal?: WorkspaceBranchPrincipal;
  operation: WorkspaceBranchOperation;
}): WorkspaceBranchAccess => {
  // An invalid tenant context must not turn a disabled setting into a bypass.
  if (configuration.workspaceId !== workspaceId) {
    return { kind: 'restricted', branchIds: [] };
  }

  if (!configuration.enabled) {
    return { kind: 'unrestricted' };
  }

  if (!principal) {
    return { kind: 'restricted', branchIds: [] };
  }

  const permittedBranches = new Set(
    configuration.branches
      .filter(
        (branch) =>
          branch.workspaceId === workspaceId &&
          (operation !== 'create' || branch.isActive),
      )
      .map((branch) => branch.id),
  );

  return {
    kind: 'restricted',
    branchIds: [
      ...new Set(
        configuration.grants
          .filter(
            (grant) =>
              grant.principal.type === principal.type &&
              grant.principal.id === principal.id &&
              grant.operations.includes(operation) &&
              permittedBranches.has(grant.branchId),
          )
          .map((grant) => grant.branchId),
      ),
    ],
  };
};
