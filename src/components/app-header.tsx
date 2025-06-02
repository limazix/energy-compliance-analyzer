
'use client';

import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import { AuthButton } from '@/components/auth-button';
import { Button } from '@/components/ui/button';

// HeaderTabValue não é mais necessário
// export type HeaderTabValue = 'past_analyses';

type AppHeaderProps = {
  onStartNewAnalysis: () => void; // Para mostrar o formulário de nova análise
  onNavigateToDashboard: () => void; // Para resetar a visualização ao clicar no logo
};

export function AppHeader({ onStartNewAnalysis, onNavigateToDashboard }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" onClick={onNavigateToDashboard} className="flex items-center space-x-2 mr-6" aria-label="Página inicial">
          <Logo className="h-8 w-auto" />
        </Link>

        <nav className="flex flex-1 items-center">
          {/* Tabs removidas */}
        </nav>

        <div className="ml-auto flex items-center space-x-4">
          <Button onClick={onStartNewAnalysis} variant="outline" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Análise
          </Button>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
