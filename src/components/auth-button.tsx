'use client';

import { signInWithPopup } from 'firebase/auth'; // signOut removed
import { LogIn, User as UserIcon } from 'lucide-react'; // LogOut removed
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
// DropdownMenu components removed
import { useAuth } from '@/contexts/auth-context';
import { auth, googleProvider } from '@/lib/firebase';

export function AuthButton() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Erro no login com Google:', error);
      // Handle error (e.g., show toast)
    }
  };

  // handleLogout logic is removed from here

  if (!user) {
    return (
      <Button onClick={handleLogin} variant="outline">
        <LogIn className="mr-2 h-4 w-4" />
        Login com Google
      </Button>
    );
  }

  // If user is authenticated, display avatar and name (non-interactive)
  return (
    <div className="flex items-center space-x-2" aria-label="User information">
      <Avatar className="h-8 w-8">
        <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? 'User Avatar'} />
        <AvatarFallback>{user.displayName?.charAt(0).toUpperCase() ?? <UserIcon />}</AvatarFallback>
      </Avatar>
      {user.displayName && (
        <div className="flex flex-col items-start text-sm">
          <span className="font-medium text-foreground leading-none">{user.displayName}</span>
          <span className="text-xs text-muted-foreground leading-none">{user.email}</span>
        </div>
      )}
    </div>
  );
}
