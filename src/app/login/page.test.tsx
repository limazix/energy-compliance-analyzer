
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { auth, googleProvider } from '@/lib/firebase'; // auth object is passed to the mocked functions
import { useToast as originalUseToast } from '@/hooks/use-toast'; // Mocked
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
    signInWithPopup: jest.fn(), // This is the key change
    // Keep other functions real if needed, or mock as necessary
    GoogleAuthProvider: actualFirebaseAuth.GoogleAuthProvider,
    onAuthStateChanged: jest.fn(() => jest.fn()), // Mock onAuthStateChanged if LoginPage indirectly uses it via useAuth initialization
    signOut: jest.fn(), // Add signOut if it could be called indirectly
  };
});

// Assign the mocked function to a variable for use in tests
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
    mockSignInWithPopup.mockClear(); // Now this should work
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
    // Check for absence of main content or presence of a loader (if one was explicitly added)
    // For now, it renders an empty div, so we check for that or the content not being there.
    expect(screen.queryByText(/Energy Compliance Analyzer/i)).not.toBeInTheDocument();
     // The component renders a div with p-4, even in loading state
    expect(container.firstChild).toHaveClass('bg-background');
  });

  it('redirects to / if user is already logged in', () => {
    useAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false });
    render(<LoginPage />);
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
  });

  it('calls signInWithPopup and redirects on successful login', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'test-uid' } }); // Simulate successful login

    render(<LoginPage />);
    const loginButton = screen.getByRole('button', { name: /Entrar com Google/i });
    fireEvent.click(loginButton);

    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
    // auth object and googleProvider are imported from @/lib/firebase and passed to the function
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
    fireEvent.click(loginButton);
    
    await waitFor(() => {
         expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
    });
    
    // Check if the mocked function (which throws an error) was called with the correct arguments.
    // This needs to be handled carefully with promises that reject.
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
