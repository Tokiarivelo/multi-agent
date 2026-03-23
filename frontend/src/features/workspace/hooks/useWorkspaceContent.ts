import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function useWorkspaceContentLogic() {
  const { t } = useTranslation('common');
  const [terminalHeight, setTerminalHeight] = useState(240);

  return { t, terminalHeight, setTerminalHeight };
}
