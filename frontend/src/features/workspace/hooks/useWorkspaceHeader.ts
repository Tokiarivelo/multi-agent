import { useTranslation } from 'react-i18next';

export function useWorkspaceHeaderLogic() {
  const { t } = useTranslation('common');
  return { t };
}
