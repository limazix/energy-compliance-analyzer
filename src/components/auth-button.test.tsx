
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // Added waitFor
import { AuthButton } from './auth-button';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
// Import the functions that the component uses so we can get their mocked versions
import { signInWithPopup, signOut as firebaseSignOutModule } from 'firebase/auth'; 
import { auth, googleProvider } from '@/lib/firebase'; // auth object is passed to the mocked functions

// Mock useAuth hook
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'), // Keep AuthProvider if needed for other tests
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

// Mock 'firebase/auth' module for specific functions used by AuthButton
jest.mock('firebase/auth', () => {
  const actualFirebaseAuth = jest.requireActual('firebase/auth');
  return {
    ...actualFirebaseAuth,
    // Mock the functions that AuthButton imports and uses
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    // Keep other functions like GoogleAuthProvider real if needed elsewhere, or mock as necessary
    GoogleAuthProvider: actualFirebaseAuth.GoogleAuthProvider, 
  };
});

// Assign the mocked functions to variables for use in tests
const mockSignInWithPopup = signInWithPopup as jest.Mock;
const mockSignOut = firebaseSignOutModule as jest.Mock;


// Mock Next.js router (already in jest.setup.js, but ensure it's effective)
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn(); // Added mockRouterReplace
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'), // Retain other exports
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace, // Added replace
  }),
}));


describe('AuthButton', () => {
  beforeEach(() => {
    // Clear mocks before each test
    useAuth.mockClear();
    mockSignInWithPopup.mockClear();
    mockSignOut.mockClear();
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear(); // Clear replace mock
  });

  describe('when user is not logged in', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: null, loading: false });
    });

    it('renders login button', () => {
      render(<AuthButton />);
      expect(screen.getByRole('button', { name: /Login com Google/i })).toBeInTheDocument();
    });

    it('calls signInWithPopup on login button click and navigates to /', async () => {
      mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'test-uid' } }); // Simulate successful login
      render(<AuthButton />);
      
      const loginButton = screen.getByRole('button', { name: /Login com Google/i });
      fireEvent.click(loginButton);

      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      // auth object and googleProvider are imported from @/lib/firebase and passed to the function
      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider); 
      
      // Wait for promises to resolve and navigation to occur
      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/'));
    });

    it('handles login error (e.g., popup closed)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      // Configure o mock para rejeitar na próxima chamada
      mockSignInWithPopup.mockRejectedValueOnce(new Error('Popup closed by user'));
      render(<AuthButton />);
      
      fireEvent.click(screen.getByRole('button', { name: /Login com Google/i }));

      // Espere que o console.error seja chamado, o que indica que a promessa foi rejeitada e capturada
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no login com Google:', expect.any(Error));
      });
      
      // Verifique também se o mock foi chamado como esperado
      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('when user is logged in', () => {
    const mockUser = {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'http://example.com/avatar.jpg',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({ user: mockUser, loading: false });
    });

    it('renders user avatar and name as dropdown trigger', () => {
      render(<AuthButton />);
      expect(screen.getByText(mockUser.displayName.split(' ')[0])).toBeInTheDocument();
      // Check for AvatarFallback content since image won't load in JSDOM
      expect(screen.getByText(mockUser.displayName.charAt(0).toUpperCase())).toBeInTheDocument();
    });

    it('shows user info and logout button in dropdown menu when opened', () => {
      render(<AuthButton />);
      const triggerButton = screen.getByText(mockUser.displayName.split(' ')[0]);
      fireEvent.click(triggerButton); // Open dropdown

      expect(screen.getByText(mockUser.displayName)).toBeInTheDocument();
      expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Configurações/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Sair/i })).toBeInTheDocument();
    });

    it('calls signOut on logout button click and navigates to /login', async () => {
      mockSignOut.mockResolvedValueOnce(undefined); // Simulate successful logout
      render(<AuthButton />);
      
      const triggerButton = screen.getByText(mockUser.displayName.split(' ')[0]);
      fireEvent.click(triggerButton); // Open dropdown
      
      const logoutButton = screen.getByRole('menuitem', { name: /Sair/i });
      fireEvent.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledWith(auth); // auth object from @/lib/firebase
      
      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/login'));
    });

     it('handles logout error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSignOut.mockRejectedValueOnce(new Error('Sign out failed'));
      render(<AuthButton />);
      
      fireEvent.click(screen.getByText(mockUser.displayName.split(' ')[0])); // Open dropdown
      fireEvent.click(screen.getByRole('menuitem', { name: /Sair/i }));

      // Check that the error was logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no logout:', expect.any(Error));
      });
      expect(mockSignOut).toHaveBeenCalledWith(auth);
      consoleErrorSpy.mockRestore();
    });

    it('handles clicking settings (currently no navigation)', () => {
      render(<AuthButton />);
      fireEvent.click(screen.getByText(mockUser.displayName.split(' ')[0])); // Open dropdown
      const settingsButton = screen.getByRole('menuitem', { name: /Configurações/i });
      fireEvent.click(settingsButton);
      // No assertion on navigation as it's a TODO
    });
  });
});

