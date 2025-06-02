
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthButton } from './auth-button';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { auth, googleProvider } from '@/lib/firebase'; // Mocked

// Mock useAuth hook
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'), // Keep AuthProvider if needed for other tests
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

// Mock Firebase auth functions that are directly called
const mockSignInWithPopup = auth.signInWithPopup as jest.Mock;
const mockSignOut = auth.signOut as jest.Mock;

// Mock Next.js router (already in jest.setup.js, but ensure it's effective)
const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'), // Retain other exports
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
  }),
}));


describe('AuthButton', () => {
  beforeEach(() => {
    // Clear mocks before each test
    useAuth.mockClear();
    mockSignInWithPopup.mockClear();
    mockSignOut.mockClear();
    mockRouterPush.mockClear();
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
      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
      
      // Wait for promises to resolve
      await screen.findByRole('button', { name: /Login com Google/i }); // Button still exists before navigation mock takes full effect
      expect(mockRouterPush).toHaveBeenCalledWith('/');
    });

    it('handles login error (e.g., popup closed)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSignInWithPopup.mockRejectedValueOnce(new Error('Popup closed by user'));
      render(<AuthButton />);
      
      fireEvent.click(screen.getByRole('button', { name: /Login com Google/i }));

      await expect(mockSignInWithPopup).rejects.toThrow('Popup closed by user');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no login com Google:', expect.any(Error));
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
      expect(screen.getByAltText(mockUser.displayName ?? 'User Avatar')).toBeInTheDocument();
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
      expect(mockSignOut).toHaveBeenCalledWith(auth);
      
      await screen.findByRole('menuitem', { name: /Sair/i }); // Ensure async operations complete
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });

     it('handles logout error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSignOut.mockRejectedValueOnce(new Error('Sign out failed'));
      render(<AuthButton />);
      
      fireEvent.click(screen.getByText(mockUser.displayName.split(' ')[0])); // Open dropdown
      fireEvent.click(screen.getByRole('menuitem', { name: /Sair/i }));

      await expect(mockSignOut).rejects.toThrow('Sign out failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no logout:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('handles clicking settings (currently no navigation)', () => {
      render(<AuthButton />);
      fireEvent.click(screen.getByText(mockUser.displayName.split(' ')[0])); // Open dropdown
      const settingsButton = screen.getByRole('menuitem', { name: /Configurações/i });
      fireEvent.click(settingsButton);
      // No assertion on navigation as it's a TODO
      // You could assert if a function was called if you passed one for settings
    });
  });
});
