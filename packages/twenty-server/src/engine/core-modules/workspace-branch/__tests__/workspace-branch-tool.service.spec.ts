import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { RoleToolProvider } from 'src/engine/core-modules/tool-provider/providers/role-tool.provider';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolExecutorService } from 'src/engine/core-modules/tool-provider/services/tool-executor.service';
import { type ToolOutputSpillService } from 'src/engine/core-modules/tool/services/tool-output-spill.service';
import { type ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { type WorkspaceBranchProvisioningService } from 'src/engine/core-modules/workspace-branch/workspace-branch-provisioning.service';
import { type WorkspaceBranchService } from 'src/engine/core-modules/workspace-branch/workspace-branch.service';
import { WorkspaceBranchToolService } from 'src/engine/core-modules/workspace-branch/tools/workspace-branch-tool.service';
import { type PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';
import { type RoleToolWorkspaceService } from 'src/engine/metadata-modules/role/tools/services/role-tool.workspace-service';
import { PermissionFlagType } from 'twenty-shared/constants';

jest.mock(
  'src/engine/core-modules/tool-provider/services/tool-executor.service',
  () => ({ ToolExecutorService: class {} }),
);
jest.mock(
  'src/engine/core-modules/tool/services/tool-output-spill.service',
  () => ({ ToolOutputSpillService: class {} }),
);
jest.mock(
  'src/engine/core-modules/exception-handler/exception-handler.service',
  () => ({ ExceptionHandlerService: class {} }),
);

const workspaceId = '6df61d37-8fdb-40ea-81e2-7b510b9de541';
const branchId = '4dc657dd-1906-4901-8853-04432eed8d2a';
const settings = {
  enabled: false,
  revision: 2,
  branches: [{ id: branchId, name: 'Centro', isActive: true }],
  grants: [],
};
const context: ToolProviderContext = {
  workspaceId,
  roleId: 'caller-role',
  rolePermissionConfig: { intersectionOf: ['caller-role', 'agent-role'] },
  authContext: {
    type: 'user',
    workspace: { id: workspaceId },
  } as unknown as WorkspaceAuthContext,
};

describe('native branch settings tools', () => {
  const branchService = {
    getConfiguration: jest.fn(),
    toDTO: jest.fn(),
    update: jest.fn(),
  };
  const provisioning = { prepare: jest.fn() };
  const permissions = { checkRolesPermissions: jest.fn() };
  const service = new WorkspaceBranchToolService(
    branchService as unknown as WorkspaceBranchService,
    provisioning as unknown as WorkspaceBranchProvisioningService,
    permissions as unknown as PermissionsService,
  );
  const provider = new RoleToolProvider(
    { generateRoleTools: () => ({}) } as unknown as RoleToolWorkspaceService,
    permissions as unknown as PermissionsService,
    service,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    permissions.checkRolesPermissions.mockResolvedValue(true);
    branchService.getConfiguration.mockResolvedValue(settings);
    branchService.toDTO.mockReturnValue(settings);
    branchService.update.mockResolvedValue({ ...settings, revision: 3 });
    provisioning.prepare.mockResolvedValue({
      objectsPrepared: 2,
      recordsAssigned: 0,
    });
  });

  it('preserves the authenticated actor when building the chat catalog and learning schemas', async () => {
    const registry = new ToolRegistryService(
      [provider],
      {} as ToolExecutorService,
      {} as ToolOutputSpillService,
      {} as ExceptionHandlerService,
    );
    const options = {
      authContext: context.authContext,
      rolePermissionConfig: context.rolePermissionConfig,
    };
    const index = await registry.buildToolIndex(
      workspaceId,
      context.roleId,
      options,
    );
    expect(index.map((tool) => tool.name)).toContain(
      'get_workspace_branch_settings',
    );
    const schemas = await registry.resolveSchemas({
      toolNames: ['update_workspace_branch_settings'],
      context,
    });
    expect(schemas.get('update_workspace_branch_settings')).toHaveProperty(
      'properties.expectedRevision',
    );
    expect(await registry.buildToolIndex(workspaceId, context.roleId)).toEqual(
      [],
    );
  });

  it('makes native settings discoverable in the existing role tool catalog', async () => {
    expect(await provider.isAvailable(context)).toBe(true);
    const descriptors = await provider.generateDescriptors(context);
    expect(descriptors.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'get_workspace_branch_settings',
        'update_workspace_branch_settings',
        'prepare_workspace_branches',
      ]),
    );
    const result = await provider.executeStaticTool(
      'get_workspace_branch_settings',
      {},
      context,
    );
    expect(result).toMatchObject({ success: true, result: settings });
    expect(branchService.getConfiguration).toHaveBeenCalledWith(workspaceId);
    expect(permissions.checkRolesPermissions).toHaveBeenCalledWith(
      context.rolePermissionConfig,
      workspaceId,
      PermissionFlagType.ROLES,
    );
  });

  it('uses the same service and revision validation when saving branch settings', async () => {
    const input = {
      expectedRevision: 2,
      enabled: false,
      branches: settings.branches,
      grants: [],
    };
    expect(
      await provider.executeStaticTool(
        'update_workspace_branch_settings',
        input,
        context,
      ),
    ).toMatchObject({ success: true });
    expect(branchService.update).toHaveBeenCalledWith(workspaceId, input);
    branchService.update.mockRejectedValueOnce(
      new Error('Branch settings changed; reload before saving'),
    );
    expect(
      await provider.executeStaticTool(
        'update_workspace_branch_settings',
        input,
        context,
      ),
    ).toMatchObject({
      success: false,
      error: 'Branch settings changed; reload before saving',
    });
  });

  it.each([
    'get_workspace_branch_settings',
    'update_workspace_branch_settings',
    'prepare_workspace_branches',
  ])('rechecks roles-management permission before %s', async (name) => {
    permissions.checkRolesPermissions.mockResolvedValue(false);
    expect(await provider.isAvailable(context)).toBe(false);
    expect(await provider.executeStaticTool(name, {}, context)).toMatchObject({
      success: false,
      error: 'Permission denied',
    });
    expect(branchService.getConfiguration).not.toHaveBeenCalled();
    expect(branchService.update).not.toHaveBeenCalled();
    expect(provisioning.prepare).not.toHaveBeenCalled();
  });

  it.each([
    'apiKey',
    'application',
    'system',
    'pendingActivationUser',
  ] as const)(
    'does not expose settings management to %s principals',
    async (type) => {
      const other = {
        ...context,
        authContext: {
          type,
          workspace: { id: workspaceId },
        } as WorkspaceAuthContext,
      };
      expect(service.generateTools(other)).toEqual({});
    },
  );

  it('does not accept a system permission bypass as settings authorization', () => {
    expect(
      service.generateTools({
        ...context,
        rolePermissionConfig: { shouldBypassPermissionChecks: true },
      }),
    ).toEqual({});
  });

  it('refuses contexts belonging to a different workspace', () => {
    expect(
      service.generateTools({ ...context, workspaceId: 'another-workspace' }),
    ).toEqual({});
  });

  it('does not let tool arguments select another workspace', async () => {
    expect(
      await provider.executeStaticTool(
        'get_workspace_branch_settings',
        { workspaceId: 'another-workspace' },
        context,
      ),
    ).toMatchObject({ success: false });
    expect(branchService.getConfiguration).not.toHaveBeenCalled();
  });

  it('prepares fields without assigning records by default', async () => {
    expect(
      await provider.executeStaticTool(
        'prepare_workspace_branches',
        {},
        context,
      ),
    ).toMatchObject({ success: true });
    expect(provisioning.prepare).toHaveBeenCalledWith(workspaceId, undefined);
  });

  it('requires acknowledgment before assigning all unclassified records', async () => {
    expect(
      await provider.executeStaticTool(
        'prepare_workspace_branches',
        { branchId },
        context,
      ),
    ).toMatchObject({ success: false });
    expect(provisioning.prepare).not.toHaveBeenCalled();
    expect(
      await provider.executeStaticTool(
        'prepare_workspace_branches',
        { branchId, assignUnclassifiedRecords: true },
        context,
      ),
    ).toMatchObject({ success: true });
    expect(provisioning.prepare).toHaveBeenCalledWith(workspaceId, branchId);
  });

  it('fails closed if the actor loses authorization after tool discovery', async () => {
    const result = await provider.executeStaticTool(
      'get_workspace_branch_settings',
      {},
      {
        ...context,
        resolveExecutionContext: async () => ({
          ...context,
          authContext: undefined,
        }),
      },
    );
    expect(result).toMatchObject({ success: false });
    expect(branchService.getConfiguration).not.toHaveBeenCalled();
  });
});
