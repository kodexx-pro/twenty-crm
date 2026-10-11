import { gql } from '@apollo/client';

export const WORKSPACE_BRANCH_ACCESS = gql`
  query WorkspaceBranchAccess {
    workspaceBranchAccess {
      enabled
      revision
      branches {
        id
        name
        isActive
      }
      grants {
        principalType
        principalId
        branchId
        operations
      }
    }
  }
`;

export const MY_WORKSPACE_BRANCHES = gql`
  query MyWorkspaceBranches {
    myWorkspaceBranches {
      enabled
      revision
      branches {
        id
        name
        isActive
        operations
      }
    }
  }
`;

export const UPDATE_WORKSPACE_BRANCH_ACCESS = gql`
  mutation UpdateWorkspaceBranchAccess(
    $input: UpdateWorkspaceBranchAccessInput!
  ) {
    updateWorkspaceBranchAccess(input: $input) {
      enabled
      revision
      branches {
        id
        name
        isActive
      }
      grants {
        principalType
        principalId
        branchId
        operations
      }
    }
  }
`;

export const PREPARE_WORKSPACE_BRANCHES = gql`
  mutation PrepareWorkspaceBranches($branchId: UUID) {
    prepareWorkspaceBranches(branchId: $branchId) {
      objectsPrepared
      recordsAssigned
    }
  }
`;
