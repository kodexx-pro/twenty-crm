import { ForbiddenException } from '@nestjs/common';
import { isNonEmptyString } from '@sniptt/guards';
import { type DataSource, In } from 'typeorm';

import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';

export const assertFilesBelongToRecordBranch = async ({
  record,
  fileFieldNames,
  workspaceId,
  coreDataSource,
}: {
  record: Record<string, unknown>;
  fileFieldNames: string[];
  workspaceId: string;
  coreDataSource: DataSource;
}): Promise<void> => {
  const fileIds = new Set<string>();
  for (const name of fileFieldNames) {
    const entries = record[name];
    if (entries === undefined || entries === null) continue;
    if (!Array.isArray(entries))
      throw new ForbiddenException('Invalid files field');
    for (const entry of entries) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !isNonEmptyString(entry.fileId)
      )
        throw new ForbiddenException('Invalid files field');
      fileIds.add(entry.fileId);
    }
  }
  if (fileIds.size === 0) return;
  const files = await coreDataSource
    .getRepository(FileEntity)
    .find({ where: { id: In([...fileIds]), workspaceId } });
  if (
    !isNonEmptyString(record.branchId) ||
    files.length !== fileIds.size ||
    files.some(
      (file) =>
        file.workspaceId !== workspaceId ||
        file.settings?.branchId !== record.branchId,
    )
  ) {
    throw new ForbiddenException(
      'Files must belong to the workspace and record branch',
    );
  }
};
