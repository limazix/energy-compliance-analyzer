
'use client';

import { signInWithPopup, signOut } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { auth, googleProvider } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

export function AuthButton() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/');
    } catch (error) {
      console.error('Erro no login com Google:', error);
      // Handle error (e.g., show toast)
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Erro no logout:', error);
      // Handle error
    }
  };

  if (!user) {
    return (
      <Button onClick={handleLogin} variant="outline">
        <LogIn className="mr-2 h-4 w-4" />
        Login com Google
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2 rounded-md h-10 px-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? 'User Avatar'} />
            <AvatarFallback>{user.displayName?.charAt(0).toUpperCase() ?? <UserIcon />}</AvatarFallback>
          </Avatar>
          {user.displayName && (
            <span className="text-sm font-medium text-foreground hidden sm:inline-block">
              {user.displayName.split(' ')[0]}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => {/* TODO: Navigate to settings or profile */}}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Configurações</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
