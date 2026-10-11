import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import { FileFolder } from 'twenty-shared/types';

import { type FileTokenJwtPayload } from 'src/engine/core-modules/auth/types/file-token-jwt-payload.type';
import { loadWorkspaceBranchConfiguration } from 'src/engine/core-modules/workspace-branch/utils/load-workspace-branch-configuration.util';
import { resolveWorkspaceBranchAccess } from 'src/engine/core-modules/workspace-branch/utils/resolve-workspace-branch-access.util';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { type FileSettings } from 'src/engine/core-modules/file/types/file-settings.type';
import { ApplicationEntity } from 'src/engine/core-modules/application/application.entity';
import { captureWorkspaceBranchDelegation } from 'src/engine/core-modules/workspace-branch/utils/build-delegated-branch-system-auth-context.util';
import { WorkspaceBranchPrincipalAuthService } from 'src/engine/core-modules/workspace-branch/workspace-branch-principal-auth.service';

@Injectable()
export class FileBranchAccessService {
  constructor(
    @InjectDataSource() private readonly coreDataSource: DataSource,
    private readonly principalAuthService: WorkspaceBranchPrincipalAuthService,
  ) {}

  async getUploadSettings(
    workspaceId: string,
    fileFolder: FileFolder,
    settings: FileSettings,
  ): Promise<FileSettings> {
    const configuration = await loadWorkspaceBranchConfiguration(
      this.coreDataSource,
      workspaceId,
    );

    if (
      !configuration.enabled ||
      fileFolder === FileFolder.CorePicture ||
      fileFolder === FileFolder.PublicAsset
    ) {
      const { branchId: _branchId, ...unscopedSettings } = settings;

      return unscopedSettings;
    }

    const scope = await this.getSigningScope(workspaceId);
    const delegation = captureWorkspaceBranchDelegation(workspaceId);
    const access = resolveWorkspaceBranchAccess({
      configuration,
      workspaceId,
      principal: scope.branchPrincipal,
      operation: 'create',
    });
    const branchId = delegation.selectedBranchId;
    const selectedBranchId =
      branchId ??
      (access.kind === 'restricted' && access.branchIds.length === 1
        ? access.branchIds[0]
        : undefined);

    if (
      access.kind !== 'restricted' ||
      !selectedBranchId ||
      !access.branchIds.includes(selectedBranchId)
    ) {
      throw new ForbiddenException(
        'Select an authorized branch before uploading a file',
      );
    }

    return { ...settings, branchId: selectedBranchId };
  }

  async getSigningScope(workspaceId: string) {
    const configuration = await loadWorkspaceBranchConfiguration(
      this.coreDataSource,
      workspaceId,
    );
    const delegation = captureWorkspaceBranchDelegation(workspaceId);
    const principal = delegation.principal;

    return {
      branchRevision: configuration.enabled
        ? configuration.revision
        : undefined,
      branchPrincipal: configuration.enabled ? principal : undefined,
      branchApplicationId: configuration.enabled
        ? delegation.applicationId
        : undefined,
    };
  }

  async assertFileOperation(
    workspaceId: string,
    fileId: string,
    operation: 'read' | 'create' | 'update' | 'delete',
  ): Promise<void> {
    const configuration = await loadWorkspaceBranchConfiguration(
      this.coreDataSource,
      workspaceId,
    );

    if (!configuration.enabled) {
      return;
    }

    const file = await this.coreDataSource
      .getRepository(FileEntity)
      .findOne({ where: { workspaceId, id: fileId } });

    if (
      file?.path.startsWith(`${FileFolder.CorePicture}/`) ||
      file?.path.startsWith(`${FileFolder.PublicAsset}/`)
    ) {
      return;
    }

    const scope = await this.getSigningScope(workspaceId);
    const access = resolveWorkspaceBranchAccess({
      configuration,
      workspaceId,
      principal: scope.branchPrincipal,
      operation,
    });

    if (
      access.kind !== 'restricted' ||
      !file?.settings?.branchId ||
      !access.branchIds.includes(file.settings.branchId)
    ) {
      throw new ForbiddenException('Branch file access denied');
    }
  }

  async assertOverwrite(
    workspaceId: string,
    file: FileEntity,
    destinationBranchId?: string,
  ) {
    await this.assertFileOperation(workspaceId, file.id, 'update');

    if (
      destinationBranchId &&
      file.settings?.branchId !== destinationBranchId
    ) {
      throw new ForbiddenException(
        'File ownership cannot be transferred by an upload',
      );
    }
  }

  async assertStreamUpload(params: {
    workspaceId: string;
    fileFolder: FileFolder;
    resourcePath: string;
    applicationUniversalIdentifier: string;
  }): Promise<void> {
    const configuration = await loadWorkspaceBranchConfiguration(
      this.coreDataSource,
      params.workspaceId,
    );

    if (
      !configuration.enabled ||
      params.fileFolder === FileFolder.CorePicture ||
      params.fileFolder === FileFolder.PublicAsset
    ) {
      return;
    }

    const application = await this.coreDataSource
      .getRepository(ApplicationEntity)
      .findOne({
        where: {
          workspaceId: params.workspaceId,
          universalIdentifier: params.applicationUniversalIdentifier,
        },
      });
    const file = application
      ? await this.coreDataSource.getRepository(FileEntity).findOne({
          where: {
            workspaceId: params.workspaceId,
            applicationId: application.id,
            path: `${params.fileFolder}/${params.resourcePath}`,
          },
        })
      : null;

    if (!file) {
      throw new ForbiddenException('Unbound file upload is not allowed');
    }

    await this.assertFileOperation(params.workspaceId, file.id, 'create');
  }

  async canDownload(
    payload: FileTokenJwtPayload,
    fileFolder: FileFolder,
  ): Promise<boolean> {
    const configuration = await loadWorkspaceBranchConfiguration(
      this.coreDataSource,
      payload.workspaceId,
    );

    if (!configuration.enabled || fileFolder === FileFolder.CorePicture) {
      return true;
    }

    const principal = payload.branchPrincipal;

    if (
      payload.branchRevision !== configuration.revision ||
      !principal ||
      !isUUID(principal.id) ||
      !['workspaceMember', 'apiKey', 'application'].includes(principal.type)
    ) {
      return false;
    }

    const access = resolveWorkspaceBranchAccess({
      configuration,
      workspaceId: payload.workspaceId,
      principal,
      operation: 'read',
    });

    try {
      await this.principalAuthService.hydrate({
        workspaceId: payload.workspaceId,
        principal,
        applicationId: payload.branchApplicationId,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return false;
      }

      throw error;
    }

    if (access.kind !== 'restricted' || access.branchIds.length === 0) {
      return false;
    }

    const file = await this.coreDataSource.getRepository(FileEntity).findOne({
      where: { id: payload.fileId, workspaceId: payload.workspaceId },
    });
    const branchId = file?.settings?.branchId;

    if (!file || !branchId || !access.branchIds.includes(branchId)) {
      return false;
    }

    if (file.settings?.isTemporaryFile) {
      return true;
    }

    // Only an actual stored attachment association can authorize a file. A
    // selected branch, an old signed URL or a guessed file UUID cannot do so.
    const schema = getWorkspaceSchemaName(payload.workspaceId);
    const attachments: { branchId: string }[] = await this.coreDataSource.query(
      `SELECT "branchId" FROM "${schema}"."attachment" WHERE "deletedAt" IS NULL AND "file" @> $1::jsonb AND "branchId" = ANY($2::uuid[])`,
      [JSON.stringify([{ fileId: payload.fileId }]), [branchId]],
    );

    return attachments.length > 0;
  }
}
