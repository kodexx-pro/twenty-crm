import type { FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type WorkspaceBranchPrincipal } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';

export type WorkspaceEventBatch<WorkspaceEvent> = {
  name: string;
  workspaceId: string;
  objectMetadata: FlatObjectMetadata;
  events: WorkspaceEvent[];
  branchPrincipal?: WorkspaceBranchPrincipal;
  selectedBranchId?: string;
};
