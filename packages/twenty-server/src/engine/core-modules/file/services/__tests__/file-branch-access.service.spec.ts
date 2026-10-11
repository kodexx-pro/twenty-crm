import { ForbiddenException } from '@nestjs/common';
import { type DataSource } from 'typeorm';
import { FileFolder } from 'twenty-shared/types';

import { type FileTokenJwtPayload } from 'src/engine/core-modules/auth/types/file-token-jwt-payload.type';
import { FileBranchAccessService } from 'src/engine/core-modules/file/services/file-branch-access.service';
import { type FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { type WorkspaceBranchPrincipalAuthService } from 'src/engine/core-modules/workspace-branch/workspace-branch-principal-auth.service';
import { loadWorkspaceBranchConfiguration } from 'src/engine/core-modules/workspace-branch/utils/load-workspace-branch-configuration.util';

jest.mock(
  'src/engine/core-modules/workspace-branch/utils/load-workspace-branch-configuration.util',
);

const workspaceId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const memberId = '33333333-3333-4333-8333-333333333333';
const fileId = '44444444-4444-4444-8444-444444444444';
const policy = {
  workspaceId,
  enabled: true,
  revision: 3,
  branches: [{ id: branchId, workspaceId, name: 'North', isActive: true }],
  grants: [
    {
      principal: { type: 'workspaceMember' as const, id: memberId },
      branchId,
      operations: ['read' as const],
    },
  ],
};

describe('FileBranchAccessService', () => {
  const findOne = jest.fn();
  const query = jest.fn();
  const dataSource = {
    getRepository: () => ({ findOne }),
    query,
  } as unknown as DataSource;
  const hydrate = jest.fn();
  const principalAuthService = {
    hydrate,
  } as unknown as WorkspaceBranchPrincipalAuthService;
  const service = new FileBranchAccessService(dataSource, principalAuthService);
  const token = {
    workspaceId,
    fileId,
    branchRevision: 3,
    branchPrincipal: { type: 'workspaceMember', id: memberId },
  } as FileTokenJwtPayload;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadWorkspaceBranchConfiguration).mockResolvedValue(policy);
    findOne.mockResolvedValue({
      settings: { branchId, isTemporaryFile: false },
    });
    query.mockResolvedValue([{ branchId }]);
    hydrate.mockResolvedValue({ type: 'user' });
  });

  it('preserves downloads when isolation is disabled', async () => {
    jest
      .mocked(loadWorkspaceBranchConfiguration)
      .mockResolvedValue({ ...policy, enabled: false });
    expect(
      await service.canDownload(
        { workspaceId, fileId } as FileTokenJwtPayload,
        FileFolder.FilesField,
      ),
    ).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects legacy actorless links and stale revisions', async () => {
    expect(
      await service.canDownload(
        { workspaceId, fileId } as FileTokenJwtPayload,
        FileFolder.FilesField,
      ),
    ).toBe(false);
    expect(
      await service.canDownload(
        { ...token, branchRevision: 2 },
        FileFolder.FilesField,
      ),
    ).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a foreign owning branch even if an attachment could be forged', async () => {
    findOne.mockResolvedValue({
      settings: { branchId: fileId, isTemporaryFile: false },
    });
    expect(await service.canDownload(token, FileFolder.FilesField)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('requires a stored attachment for a finalized file', async () => {
    query.mockResolvedValue([]);
    expect(await service.canDownload(token, FileFolder.FilesField)).toBe(false);
    query.mockResolvedValue([{ branchId }]);
    expect(await service.canDownload(token, FileFolder.FilesField)).toBe(true);
    expect(query.mock.calls[1][1]).toEqual([
      JSON.stringify([{ fileId }]),
      [branchId],
    ]);
  });

  it('permits a temporary upload preview only for a granted durable branch', async () => {
    findOne.mockResolvedValue({
      settings: { branchId, isTemporaryFile: true },
    });
    expect(await service.canDownload(token, FileFolder.FilesField)).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it('denies uploads without an authenticated branch principal', async () => {
    await expect(
      service.getUploadSettings(workspaceId, FileFolder.FilesField, {
        isTemporaryFile: true,
        toDelete: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('forbids overwriting a foreign file or moving ownership through upload', async () => {
    const scope = jest
      .spyOn(service, 'getSigningScope')
      .mockResolvedValue({
        branchRevision: 3,
        branchPrincipal: { type: 'workspaceMember', id: memberId },
        branchApplicationId: undefined,
      });
    jest
      .mocked(loadWorkspaceBranchConfiguration)
      .mockResolvedValue({
        ...policy,
        grants: [{ ...policy.grants[0], operations: ['update'] }],
      });
    const file = {
      id: fileId,
      path: `${FileFolder.FilesField}/file`,
      settings: { branchId, isTemporaryFile: false, toDelete: false },
    } as FileEntity;
    findOne.mockResolvedValue(file);

    await expect(
      service.assertOverwrite(workspaceId, file, memberId),
    ).rejects.toThrow('cannot be transferred');
    findOne.mockResolvedValue({ ...file, settings: { branchId: memberId } });
    await expect(
      service.assertOverwrite(workspaceId, file, branchId),
    ).rejects.toThrow('access denied');
    scope.mockRestore();
  });

  it('rejects an unbound stream upload in an isolated workspace', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      service.assertStreamUpload({
        workspaceId,
        fileFolder: FileFolder.FilesField,
        resourcePath: 'file',
        applicationUniversalIdentifier: memberId,
      }),
    ).rejects.toThrow('Unbound file upload');
  });

  it('rejects a removed principal even when branch grants and revision are unchanged', async () => {
    hydrate.mockRejectedValueOnce(
      new ForbiddenException('Workspace member is no longer authorized'),
    );
    expect(await service.canDownload(token, FileFolder.FilesField)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
