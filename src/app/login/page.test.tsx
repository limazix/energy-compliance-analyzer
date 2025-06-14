/**
 * @fileoverview Test suite for the LoginPage component.
 * This file contains tests to ensure the LoginPage renders correctly based on authentication state,
 * handles login attempts (success and failure), and manages redirection, structured in a BDD style.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWithPopup as firebaseSignInWithPopupModule } from 'firebase/auth';

import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useToast as originalUseToast } from '@/hooks/use-toast';
import { auth, googleProvider } from '@/lib/firebase';

import LoginPage from './page';

// Mock useAuth hook
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

// Mock useToast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(),
}));
const useToast = originalUseToast as jest.Mock;
const mockToastFn = jest.fn();

// Mock 'firebase/auth' module for signInWithPopup
jest.mock('firebase/auth', () => {
  const actualFirebaseAuth = jest.requireActual('firebase/auth');
  return {
    ...actualFirebaseAuth,
    signInWithPopup: jest.fn(),
    GoogleAuthProvider: actualFirebaseAuth.GoogleAuthProvider,
    onAuthStateChanged: jest.fn(() => jest.fn()), // Keep the onAuthStateChanged mock as is
    signOut: jest.fn(),
  };
});

const mockSignInWithPopup = firebaseSignInWithPopupModule as jest.Mock;

// Mock Next.js router
const mockRouterReplace = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
  }),
}));

/**
 * @describe LoginPage component test suite.
 * This suite covers rendering logic, user interactions for login,
 * and redirection based on authentication status, following BDD principles.
 */
describe('LoginPage', () => {
  beforeEach(() => {
    useAuth.mockClear();
    mockSignInWithPopup.mockClear();
    mockRouterReplace.mockClear();
    useToast.mockReturnValue({ toast: mockToastFn });
    mockToastFn.mockClear();
    // Clear the globally mocked console.error before each test in this suite
    if (typeof window !== 'undefined' && (window.console.error as jest.Mock)?.mockClear) {
      (window.console.error as jest.Mock).mockClear();
    } else if ((global.console.error as jest.Mock)?.mockClear) {
      (global.console.error as jest.Mock).mockClear();
    }
  });

  /**
   * @describe Scenario: User is not authenticated and authentication is not loading.
   */
  describe('given the user is not authenticated and auth is not loading', () => {
    /**
     * @it It should render the login form correctly.
     */
    it('should render the login form with title, description, and Google login button', () => {
      useAuth.mockReturnValue({ user: null, loading: false });
      render(<LoginPage />);

      expect(screen.getByAltText('EMA - Electric Magnitudes Analizer Logo')).toBeInTheDocument();
      expect(
        screen.getByText(/Acesse para analisar dados de qualidade de energia/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Entrar com Google/i })).toBeInTheDocument();
    });
  });

  /**
   * @describe Scenario: Authentication is in a loading state.
   */
  describe('given authentication is loading', () => {
    /**
     * @it It should display a loading state and not the login form.
     */
    it('should display a loading state and not the login form', () => {
      useAuth.mockReturnValue({ user: null, loading: true });
      const { container } = render(<LoginPage />);
      expect(
        screen.queryByAltText('EMA - Electric Magnitudes Analizer Logo')
      ).not.toBeInTheDocument();
      // Check for a general loading indicator presence, assuming it takes over the screen.
      // This might need adjustment based on actual loading UI.
      expect(container.firstChild).toHaveClass('bg-background'); // Or a more specific loader class/testid
    });
  });

  /**
   * @describe Scenario: User is already authenticated.
   */
  describe('given the user is already authenticated', () => {
    /**
     * @it It should redirect to the home page ("/").
     */
    it('should redirect to the home page ("/")', () => {
      useAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false });
      render(<LoginPage />);
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  /**
   * @describe Scenario: User attempts to log in.
   */
  describe('when the user attempts to log in', () => {
    /**
     * @describe Scenario: Login is successful.
     */
    describe('and login is successful', () => {
      beforeEach(() => {
        useAuth.mockReturnValue({ user: null, loading: false });
        // Reset to ensure it's a fresh "once" for this block if needed, or rely on general mock if set per test
        mockSignInWithPopup.mockReset();
        mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'test-uid' } });
      });

      /**
       * @it It should call signInWithPopup with Google provider.
       */
      it('should call signInWithPopup with Google provider', async () => {
        render(<LoginPage />);
        const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
        await userEvent.click(loginButton);
        expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
      });

      /**
       * @it It should show a success toast message.
       */
      it('should show a success toast message', async () => {
        render(<LoginPage />);
        const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
        await userEvent.click(loginButton);
        await waitFor(() => {
          expect(mockToastFn).toHaveBeenCalledWith({
            title: 'Login bem-sucedido!',
            description: 'Bem-vindo(a) de volta.',
          });
        });
      });

      /**
       * @it It should redirect to the home page ("/").
       */
      it('should redirect to the home page ("/")', async () => {
        render(<LoginPage />);
        const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
        await userEvent.click(loginButton);
        await waitFor(() => {
          expect(mockRouterReplace).toHaveBeenCalledWith('/');
        });
      });
    });

    /**
     * @describe Scenario: Login fails.
     */
    describe('and login fails', () => {
      beforeEach(() => {
        // This beforeEach applies to all tests in "and login fails"
        useAuth.mockReturnValue({ user: null, loading: false });
        (firebaseSignInWithPopupModule as jest.Mock).mockRejectedValue(new Error('Login failed'));
        // Clear the global console.error mock before each test in this specific describe block
        const consoleErrorMock = (
          typeof window !== 'undefined' ? window.console.error : global.console.error
        ) as jest.Mock;
        if (consoleErrorMock?.mockClear) {
          consoleErrorMock.mockClear();
        }
      });

      /**
       * @it It should call signInWithPopup.
       */
      it('should call signInWithPopup', async () => {
        render(<LoginPage />);
        const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
        await userEvent.click(loginButton);
        expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      });

      /**
       * @it It should log an error to the console.
       */
      it('should log an error to the console', async () => {
        render(<LoginPage />);
        const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
        await userEvent.click(loginButton);

        // Wait for the toast message as a synchronization point,
        // because console.error is called before toast in the component.
        await waitFor(() => {
          expect(mockToastFn).toHaveBeenCalledWith({
            title: 'Erro no Login',
            description: 'Não foi possível fazer login com Google. Tente novamente.',
            variant: 'destructive',
          });
        });

        // Now assert that console.error (which is globally mocked in jest.setup.js) was called.
        const consoleErrorMock = (
          typeof window !== 'undefined' ? window.console.error : global.console.error
        ) as jest.Mock;
        expect(consoleErrorMock).toHaveBeenCalledWith(
          'Erro no login com Google:',
          expect.any(Error)
        );
      });

      /**
       * @it It should show an error toast message.
       */
      it('should show an error toast message', async () => {
        render(<LoginPage />);
        const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
        await userEvent.click(loginButton);
        await waitFor(() => {
          expect(mockToastFn).toHaveBeenCalledWith({
            title: 'Erro no Login',
            description: 'Não foi possível fazer login com Google. Tente novamente.',
            variant: 'destructive',
          });
        });
      });
    });
  });
});
