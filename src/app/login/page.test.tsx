
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { auth, googleProvider } from '@/lib/firebase';
import { useToast as originalUseToast } from '@/hooks/use-toast';
import { signInWithPopup as firebaseSignInWithPopupModule } from 'firebase/auth';

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
    onAuthStateChanged: jest.fn(() => jest.fn()),
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

describe('LoginPage', () => {
  beforeEach(() => {
    useAuth.mockClear();
    mockSignInWithPopup.mockClear();
    mockRouterReplace.mockClear();
    useToast.mockReturnValue({ toast: mockToastFn });
    mockToastFn.mockClear();
  });

  it('renders correctly when user is not logged in and not loading', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<LoginPage />);

    expect(screen.getByText(/Energy Compliance Analyzer/i)).toBeInTheDocument();
    expect(screen.getByText(/Acesse para analisar dados de qualidade de energia/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar com Google/i })).toBeInTheDocument();
  });

  it('shows loading/redirecting state if auth is loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<LoginPage />);
    expect(screen.queryByText(/Energy Compliance Analyzer/i)).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-background');
  });

  it('redirects to / if user is already logged in', () => {
    useAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false });
    render(<LoginPage />);
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
  });

  it('calls signInWithPopup and redirects on successful login', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'test-uid' } });

    render(<LoginPage />);
    const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
    await userEvent.click(loginButton);

    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
    expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);

    await waitFor(() => {
      expect(mockToastFn).toHaveBeenCalledWith({
        title: 'Login bem-sucedido!',
        description: 'Bem-vindo(a) de volta.',
      });
    });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });

  it('shows error toast on failed login', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSignInWithPopup.mockRejectedValueOnce(new Error('Login failed'));

    render(<LoginPage />);
    const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
    await userEvent.click(loginButton);
    
    await waitFor(() => {
         expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
    });
    
    await expect(mockSignInWithPopup(auth, googleProvider)).rejects.toThrow('Login failed');

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no login com Google:', expect.any(Error));
    });
    
    await waitFor(() => {
      expect(mockToastFn).toHaveBeenCalledWith({
        title: 'Erro no Login',
        description: 'Não foi possível fazer login com Google. Tente novamente.',
        variant: 'destructive',
      });
    });
    consoleErrorSpy.mockRestore();
  });
});
