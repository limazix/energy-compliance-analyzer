/**
 * @fileoverview Next.js navigation mocks for Jest.
 */
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { NextRouter } from 'next/dist/shared/lib/router/router';
import type { ReadonlyURLSearchParams } from 'next/navigation';

export const mockRouterPush = jest.fn();
export const mockRouterReplace = jest.fn();
export const mockRouterBack = jest.fn();
export const mockRouterPrefetch = jest.fn();
export const mockUsePathname = jest.fn(() => '/');
export const mockUseSearchParams = jest.fn(() => new URLSearchParams() as ReadonlyURLSearchParams);
export const mockUseParams = jest.fn(() => ({}));

// This mock covers both App Router (AppRouterInstance) and Pages Router (NextRouter)
// by providing a superset of their commonly used properties/methods.
const mockRouter: NextRouter & Partial<AppRouterInstance> = {
  basePath: '',
  pathname: '/',
  route: '/',
  query: {},
  asPath: '/',
  push: mockRouterPush,
  replace: mockRouterReplace,
  reload: jest.fn(),
  back: mockRouterBack,
  prefetch: mockRouterPrefetch,
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  forward: jest.fn(), // For AppRouterInstance
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: mockUsePathname,
  useSearchParams: mockUseSearchParams,
  useParams: mockUseParams,
  // Mock other exports from 'next/navigation' if needed by your components
  // e.g., RedirectType, notFound, redirect
  RedirectType: { replace: 'replace', push: 'push' }, // Enum-like object
  notFound: jest.fn(() => {
    throw new Error('notFound() called in test');
  }),
  redirect: jest.fn((url: string, type?: string) => {
    if (type === 'replace') {
      mockRouterReplace(url);
    } else {
      mockRouterPush(url);
    }
  }),
}));
