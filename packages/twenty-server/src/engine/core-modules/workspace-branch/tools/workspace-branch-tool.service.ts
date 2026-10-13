import { Injectable } from '@nestjs/common';
import { type ToolSet } from 'ai';
import { z } from 'zod';
import { PermissionFlagType } from 'twenty-shared/constants';

import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { WORKSPACE_BRANCH_OPERATIONS } from 'src/engine/core-modules/workspace-branch/workspace-branch.constants';
import { WorkspaceBranchProvisioningService } from 'src/engine/core-modules/workspace-branch/workspace-branch-provisioning.service';
import { WorkspaceBranchService } from 'src/engine/core-modules/workspace-branch/workspace-branch.service';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';

const branchSettingsSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    enabled: z.boolean(),
    branches: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: z.string().trim().min(1).max(100),
            isActive: z.boolean(),
          })
          .strict(),
      )
      .max(200),
    grants: z
      .array(
        z
          .object({
            principalType: z.enum(['workspaceMember', 'apiKey', 'application']),
            principalId: z.uuid(),
            branchId: z.uuid(),
            operations: z.array(z.enum(WORKSPACE_BRANCH_OPERATIONS)).max(6),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict();

const preparationSchema = z
  .object({
    branchId: z.uuid().optional(),
    assignUnclassifiedRecords: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.branchId
        ? input.assignUnclassifiedRecords === true
        : input.assignUnclassifiedRecords !== true,
    { message: 'Assigning existing records requires explicit acknowledgment.' },
  );

@Injectable()
export class WorkspaceBranchToolService {
  constructor(
    private readonly workspaceBranchService: WorkspaceBranchService,
    private readonly provisioningService: WorkspaceBranchProvisioningService,
    private readonly permissionsService: PermissionsService,
  ) {}

  private hasUserContext(context: ToolProviderContext): boolean {
    return (
      context.authContext?.type === 'user' &&
      context.authContext.workspace.id === context.workspaceId &&
      !context.authContext.viaApplication &&
      !('shouldBypassPermissionChecks' in context.rolePermissionConfig)
    );
  }

  private async run(
    context: ToolProviderContext,
    action: (workspaceId: string) => Promise<object>,
  ): Promise<ToolOutput> {
    try {
      const current = await (context.resolveExecutionContext?.() ?? context);
      if (
        current.workspaceId !== context.workspaceId ||
        !this.hasUserContext(current) ||
        !(await this.permissionsService.checkRolesPermissions(
          current.rolePermissionConfig,
          current.workspaceId,
          PermissionFlagType.ROLES,
        ))
      ) {
        return {
          success: false,
          message:
            'Branch settings require an authenticated workspace user with roles-management permission.',
          error: 'Permission denied',
        };
      }
      return {
        success: true,
        message: 'Workspace branch settings operation completed.',
        result: await action(current.workspaceId),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to manage branch settings.';
      return { success: false, message, error: message };
    }
  }

  generateTools(context: ToolProviderContext): ToolSet {
    if (!this.hasUserContext(context)) return {};
    return {
      get_workspace_branch_settings: {
        description:
          'Read the native branch configuration at Settings > General > Branches (Filiais), including isolation, saved branches, grants and revision. This configuration is separate from any custom CRM object named Branches or Filiais. Read this before proposing changes; do not create a duplicate custom object to manage native branches.',
        inputSchema: z.object({}).strict(),
        execute: async (parameters: unknown) =>
          this.run(context, async (workspaceId) => {
            z.object({}).strict().parse(parameters);
            return this.workspaceBranchService.toDTO(
              await this.workspaceBranchService.getConfiguration(workspaceId),
            );
          }),
      },
      update_workspace_branch_settings: {
        description:
          'Save native branch settings using the latest revision returned by get_workspace_branch_settings. This replaces the complete branches and grants lists: preserve all entries unless the user requests a change. Use the same isolation and grant validation as the settings interface. Existing records must be classified before enabling isolation; do not disable isolation unless explicitly requested.',
        inputSchema: branchSettingsSchema,
        execute: async (parameters: unknown) =>
          this.run(context, async (workspaceId) =>
            this.workspaceBranchService.update(
              workspaceId,
              branchSettingsSchema.parse(parameters),
            ),
          ),
      },
      prepare_workspace_branches: {
        description:
          "Prepare the native protected branch fields and indexes. Without branchId, no records are assigned. Supplying a saved branchId assigns ALL currently unclassified business records to it; do this only at the user's explicit request and set assignUnclassifiedRecords=true to acknowledge the bulk assignment. Already classified records retain their branch.",
        inputSchema: preparationSchema,
        execute: async (parameters: unknown) =>
          this.run(context, async (workspaceId) => {
            const input = preparationSchema.parse(parameters);
            return this.provisioningService.prepare(
              workspaceId,
              input.branchId,
            );
          }),
      },
    };
  }
}
