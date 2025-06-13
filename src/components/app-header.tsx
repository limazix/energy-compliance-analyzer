'use client';

import { signOut } from 'firebase/auth'; // Added signOut
import { PlusCircle, LogOut } from 'lucide-react'; // Added LogOut
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Added useRouter

import { AuthButton } from '@/components/auth-button';
import { Logo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { auth } from '@/lib/firebase'; // Added auth

type AppHeaderProps = {
  onStartNewAnalysis?: () => void;
  onNavigateToDashboard?: () => void;
};

export function AppHeader({ onStartNewAnalysis, onNavigateToDashboard }: AppHeaderProps) {
  const { user } = useAuth();
  const router = useRouter(); // Initialize router

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Erro no logout:', error);
      // Handle error (e.g., show toast)
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4">
        <Link
          href="/"
          onClick={() => onNavigateToDashboard?.()}
          className="flex items-center space-x-2 mr-6"
          aria-label="Página inicial"
        >
          <Logo className="h-8 w-auto" />
        </Link>

        <nav className="flex flex-1 items-center">{/* Tabs removidas */}</nav>

        <div className="ml-auto flex items-center space-x-4">
          {user && (
            <>
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
            </>
          )}
          <AuthButton />
          {user && ( // Conditionally render the Logout button
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
