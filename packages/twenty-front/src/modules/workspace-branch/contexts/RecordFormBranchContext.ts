import { createContext } from 'react';

export const RecordFormBranchContext = createContext<{
  enabled: boolean;
  branchId: string | null;
}>({ enabled: false, branchId: null });
