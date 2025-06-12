'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // eslint-disable-next-line no-console
      console.debug(
        '[AuthProvider] Auth state changed. currentUser:',
        currentUser
          ? { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName }
          : null
      );
      if (currentUser && !currentUser.uid) {
        // eslint-disable-next-line no-console
        console.error(
          '[AuthProvider] CRITICAL: currentUser exists but uid is missing or empty!',
          currentUser
        );
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
