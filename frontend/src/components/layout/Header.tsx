'use client';

import { Button } from '@/components/ui/button';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;
  const { t } = useTranslation();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground/90 tracking-tight">
          {t('Welcome back!')}
        </h2>
      </div>
      {/* 
        We also added the user profile and logout to Sidebar as requested by the user.
        But having it in Header might also be relevant, or we can just keep it translated. 
      */}
      <div className="flex items-center gap-4">
        {user && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
              <User className="h-4 w-4" />
              <span className="font-medium text-foreground/80">{user.name || user.email}</span>
            </div>
            {/* Keeping logout button mostly for translation/UI completion, though Sidebar has it */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <LogOut className="h-4 w-4" />
              {t('Logout')}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
