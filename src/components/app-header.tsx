
'use client';

import Link from 'next/link';
import { Logo } from '@/components/icons/logo';
import { AuthButton } from '@/components/auth-button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Definindo os possíveis valores para as abas de forma explícita
export type HeaderTabValue = 'past_analyses';

type AppHeaderProps = {
  activeTab: HeaderTabValue | undefined; // Allow undefined for no active tab
  onTabChange: (value: HeaderTabValue) => void;
  onNavigateToDashboard: () => void;
};

export function AppHeader({ activeTab, onTabChange, onNavigateToDashboard }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" onClick={onNavigateToDashboard} className="flex items-center space-x-2 mr-6" aria-label="Página inicial">
          <Logo className="h-8 w-auto" />
        </Link>

        <nav className="flex flex-1 items-center">
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as HeaderTabValue)} className="h-full">
            <TabsList className="h-full rounded-none border-0 bg-transparent p-0">
              {/* "Dashboard" tab removed */}
              <TabsTrigger 
                value="past_analyses" 
                className="h-full rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/50"
              >
                Análises Anteriores
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>

        <div className="ml-auto">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
