/**
 * @fileoverview
 * This module defines the `AppFooter` component, which provides a consistent
 * footer for all pages of the application.
 */

import Link from 'next/link';

/**
 * A reusable footer component that includes the copyright notice and links
 * to the privacy policy and terms of service.
 * @returns {JSX.Element} The rendered footer component.
 */
export function AppFooter() {
  return (
    <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
      © {new Date().getFullYear()} EMA - Electric Magnitudes Analyzer. Todos os direitos
      reservados.
      <div className="mt-1">
        <Link href="/privacy-policy" className="hover:underline">
          Política de Privacidade
        </Link>
        {' | '}
        <Link href="/terms-of-service" className="hover:underline">
          Termos de Serviço
        </Link>
      </div>
    </footer>
  );
}
