/**
 * @fileoverview
 * This module defines the `ReportLoading` component, which displays a
 * full-page loading indicator.
 */

import { Loader2 } from 'lucide-react';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';

/**
 * A component that displays a centered loading spinner within the app's layout.
 * @returns {JSX.Element} The rendered loading state component.
 */
export function ReportLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main
        className="container mx-auto py-8 px-4 flex-1 flex items-center justify-center"
        aria-busy="true"
      >
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
      <AppFooter />
    </div>
  );
}
