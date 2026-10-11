import { ForbiddenException } from '@nestjs/common';
import { type DataSource } from 'typeorm';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { ApiKeyEntity } from 'src/engine/core-modules/api-key/api-key.entity';
import { ApplicationEntity } from 'src/engine/core-modules/application/application.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { loadWorkspaceBranchConfiguration } from 'src/engine/core-modules/workspace-branch/utils/load-workspace-branch-configuration.util';
import { WorkspaceBranchPrincipalAuthService } from 'src/engine/core-modules/workspace-branch/workspace-branch-principal-auth.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

jest.mock(
  'src/engine/core-modules/workspace-branch/utils/load-workspace-branch-configuration.util',
);

const workspaceId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const applicationId = '44444444-4444-4444-8444-444444444444';
const dates = { createdAt: new Date(), updatedAt: new Date() };

describe('WorkspaceBranchPrincipalAuthService', () => {
  const workspace = jest.fn();
  const userWorkspace = jest.fn();
  const user = jest.fn();
  const apiKey = jest.fn();
  const application = jest.fn();
  const query = jest.fn();
  const repositories = new Map<unknown, jest.Mock>([
    [WorkspaceEntity, workspace],
    [UserWorkspaceEntity, userWorkspace],
    [UserEntity, user],
    [ApiKeyEntity, apiKey],
    [ApplicationEntity, application],
  ]);
  const dataSource = {
    getRepository: (entity: unknown) => ({ findOne: repositories.get(entity) }),
    query,
  } as unknown as DataSource;
  const service = new WorkspaceBranchPrincipalAuthService(dataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadWorkspaceBranchConfiguration).mockResolvedValue({
      workspaceId,
      enabled: true,
      revision: 1,
      branches: [],
      grants: [],
    });
    workspace.mockResolvedValue({
      id: workspaceId,
      activationStatus: WorkspaceActivationStatus.ACTIVE,
      ...dates,
    });
    query.mockResolvedValue([{ id: memberId, userId }]);
    userWorkspace.mockResolvedValue({ id: memberId, workspaceId, userId });
    user.mockResolvedValue({ id: userId, disabled: false, ...dates });
    apiKey.mockResolvedValue({
      id: memberId,
      workspaceId,
      expiresAt: new Date(Date.now() + 60000),
      ...dates,
    });
    application.mockResolvedValue({
      id: applicationId,
      workspaceId,
      defaultRoleId: memberId,
    });
  });

  it('preserves anonymous system jobs only when isolation is disabled', async () => {
    jest.mocked(loadWorkspaceBranchConfiguration).mockResolvedValue({
      workspaceId,
      enabled: false,
      revision: 0,
      branches: [],
      grants: [],
    });
    expect((await service.hydrate({ workspaceId })).type).toBe('system');
    expect(workspace).not.toHaveBeenCalled();
  });

  it('does not elevate an anonymous isolated job to system', async () => {
    await expect(service.hydrate({ workspaceId })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rehydrates a real member with the current workspace role subject', async () => {
    const context = await service.hydrate({
      workspaceId,
      principal: { type: 'workspaceMember', id: memberId },
    });
    expect(context.type).toBe('user');
    expect(context).toMatchObject({
      userWorkspaceId: memberId,
      workspaceMemberId: memberId,
      user: { id: userId },
    });
    expect(userWorkspace).toHaveBeenCalledWith({
      where: { workspaceId, userId },
    });
    expect(query.mock.calls[0][1]).toEqual([memberId]);
  });

  it('rejects deleted membership and disabled users instead of trusting queued actor snapshots', async () => {
    userWorkspace.mockResolvedValueOnce(null);
    await expect(
      service.hydrate({
        workspaceId,
        principal: { type: 'workspaceMember', id: memberId },
      }),
    ).rejects.toThrow(ForbiddenException);
    user.mockResolvedValueOnce({ id: userId, disabled: true });
    await expect(
      service.hydrate({
        workspaceId,
        principal: { type: 'workspaceMember', id: memberId },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('retains the current restricting application role on delegated user events', async () => {
    const context = await service.hydrate({
      workspaceId,
      principal: { type: 'workspaceMember', id: memberId },
      applicationId,
    });
    expect(context).toMatchObject({
      type: 'user',
      application: { id: applicationId, defaultRoleId: memberId },
    });
    expect(application).toHaveBeenCalledWith({
      where: { workspaceId, id: applicationId },
    });
  });

  it('rejects a revoked or expired API key when a queued job executes', async () => {
    apiKey.mockResolvedValueOnce({ revokedAt: new Date() });
    await expect(
      service.hydrate({
        workspaceId,
        principal: { type: 'apiKey', id: memberId },
      }),
    ).rejects.toThrow(ForbiddenException);
    apiKey.mockResolvedValueOnce({ expiresAt: new Date(0) });
    await expect(
      service.hydrate({
        workspaceId,
        principal: { type: 'apiKey', id: memberId },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rehydrates API keys and installed applications with their real role subject', async () => {
    expect(
      (
        await service.hydrate({
          workspaceId,
          principal: { type: 'apiKey', id: memberId },
        })
      ).type,
    ).toBe('apiKey');
    expect(
      (
        await service.hydrate({
          workspaceId,
          principal: { type: 'application', id: applicationId },
        })
      ).type,
    ).toBe('application');
    application.mockResolvedValueOnce(null);
    await expect(
      service.hydrate({
        workspaceId,
        principal: { type: 'application', id: applicationId },
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
