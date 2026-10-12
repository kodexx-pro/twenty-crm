import { Navigate } from 'react-router-dom';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';

export const SettingsEnterprise = () => (
  <Navigate to={getSettingsPath(SettingsPath.General)} replace />
);
