import { type CommonPropertiesJwtPayload } from 'src/engine/core-modules/auth/types/common-properties-jwt-payload.type';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';
import { type WorkspaceBranchPrincipal } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';

export type FileTokenJwtPayload = CommonPropertiesJwtPayload & {
  type: JwtTokenTypeEnum.FILE;
  workspaceId: string;
  fileId: string;
  branchRevision?: number;
  branchPrincipal?: WorkspaceBranchPrincipal;
};
