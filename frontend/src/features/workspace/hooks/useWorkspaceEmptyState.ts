import { useTranslation } from 'react-i18next';

export function useWorkspaceEmptyStateLogic() {
  const { t } = useTranslation('common');
  return { t };
}
