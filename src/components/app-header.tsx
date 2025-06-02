
'use client';

import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import { AuthButton } from '@/components/auth-button';
import { Button } from '@/components/ui/button';

type AppHeaderProps = {
  onStartNewAnalysis?: () => void; // Made optional
  onNavigateToDashboard?: () => void; // Made optional
};

export function AppHeader({ onStartNewAnalysis, onNavigateToDashboard }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link 
          href="/" 
          onClick={() => onNavigateToDashboard?.()} 
          className="flex items-center space-x-2 mr-6" 
          aria-label="Página inicial"
        >
          <Logo className="h-8 w-auto" />
        </Link>

        <nav className="flex flex-1 items-center">
          {/* Tabs removidas */}
        </nav>

        <div className="ml-auto flex items-center space-x-4">
          {onStartNewAnalysis ? (
            <Button onClick={onStartNewAnalysis} variant="outline" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Análise
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova Análise
              </Link>
            </Button>
          )}
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
