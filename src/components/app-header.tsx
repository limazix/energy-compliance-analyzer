'use client';

import Link from 'next/link';
import { Logo } from '@/components/icons/logo';
import { AuthButton } from '@/components/auth-button';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Logo className="h-8 w-auto" />
        </Link>
        <AuthButton />
      </div>
    </header>
  );
}
