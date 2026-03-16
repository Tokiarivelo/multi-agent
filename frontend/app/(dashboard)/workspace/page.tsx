'use client';

import { LocalWorkspace } from '@/features/workspace/components/LocalWorkspace';

export default function WorkspacePage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-6 overflow-hidden">
        <LocalWorkspace />
      </div>
    </div>
  );
}
