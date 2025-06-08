
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthButton } from './auth-button';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { signInWithPopup, signOut as firebaseSignOutModule } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

jest.mock('firebase/auth', () => {
  const actualFirebaseAuth = jest.requireActual('firebase/auth');
  return {
    ...actualFirebaseAuth,
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: actualFirebaseAuth.GoogleAuthProvider,
  };
});

const mockSignInWithPopup = signInWithPopup as jest.Mock;
const mockSignOut = firebaseSignOutModule as jest.Mock;

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
}));

describe('AuthButton', () => {
  beforeEach(() => {
    useAuth.mockClear();
    mockSignInWithPopup.mockClear();
    mockSignOut.mockClear();
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
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
      mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'test-uid' } });
      render(<AuthButton />);
      
      const loginButton = screen.getByRole('button', { name: /Login com Google/i });
      await userEvent.click(loginButton);

      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
      
      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/'));
    });

    it('handles login error (e.g., popup closed)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSignInWithPopup.mockRejectedValueOnce(new Error('Popup closed by user'));
      render(<AuthButton />);
      
      await userEvent.click(screen.getByRole('button', { name: /Login com Google/i }));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no login com Google:', expect.any(Error));
      });
      
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
      expect(screen.getByText(mockUser.displayName.charAt(0).toUpperCase())).toBeInTheDocument();
    });

    it('shows user info and logout button in dropdown menu when opened', async () => {
      render(<AuthButton />);
      const triggerButton = screen.getByText(mockUser.displayName.split(' ')[0]);
      await userEvent.click(triggerButton);

      const menu = await screen.findByTestId('auth-dropdown-menu');
      expect(menu).toBeInTheDocument();

      expect(within(menu).getByText(mockUser.displayName)).toBeInTheDocument();
      expect(within(menu).getByText(mockUser.email)).toBeInTheDocument();
      expect(within(menu).getByRole('menuitem', { name: /Configurações/i })).toBeInTheDocument();
      expect(within(menu).getByRole('menuitem', { name: /Sair/i })).toBeInTheDocument();
    });

    it('calls signOut on logout button click and navigates to /login', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);
      render(<AuthButton />);
      
      const triggerButton = screen.getByText(mockUser.displayName.split(' ')[0]);
      await userEvent.click(triggerButton);
      
      const menu = await screen.findByTestId('auth-dropdown-menu');
      const logoutButton = within(menu).getByRole('menuitem', { name: /Sair/i });
      await userEvent.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledWith(auth);
      
      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/login'));
    });

     it('handles logout error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSignOut.mockRejectedValueOnce(new Error('Sign out failed'));
      render(<AuthButton />);
      
      await userEvent.click(screen.getByText(mockUser.displayName.split(' ')[0]));
      const menu = await screen.findByTestId('auth-dropdown-menu');
      const logoutButton = within(menu).getByRole('menuitem', { name: /Sair/i });
      await userEvent.click(logoutButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no logout:', expect.any(Error));
      });
      expect(mockSignOut).toHaveBeenCalledWith(auth);
      consoleErrorSpy.mockRestore();
    });

    it('handles clicking settings (currently no navigation)', async () => {
      render(<AuthButton />);
      await userEvent.click(screen.getByText(mockUser.displayName.split(' ')[0]));
      const menu = await screen.findByTestId('auth-dropdown-menu');
      const settingsButton = within(menu).getByRole('menuitem', { name: /Configurações/i });
      await userEvent.click(settingsButton);
    });
  });
});
