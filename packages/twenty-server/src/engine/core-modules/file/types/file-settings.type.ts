export type FileFieldSettings = {
  isTemporaryFile: boolean;
  toDelete: boolean;
  // Server-owned branch assignment, never accepted from an upload request.
  branchId?: string;
};

export type FileSettings = FileFieldSettings;
