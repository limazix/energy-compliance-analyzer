/**
 * @fileoverview Test suite for the AuthButton component.
 * This file contains tests to verify the AuthButton's behavior for both
 * authenticated and unauthenticated users, including login/logout actions and UI rendering,
 * structured in BDD style.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWithPopup, signOut as firebaseSignOutModule } from 'firebase/auth';

import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { auth, googleProvider } from '@/lib/firebase';

import { AuthButton } from './auth-button';

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

/**
 * @describe Test suite for the AuthButton component.
 * It covers rendering the correct button (login or user dropdown)
 * based on authentication state and handling login/logout interactions, following BDD principles.
 */
describe('AuthButton component', () => {
  beforeEach(() => {
    useAuth.mockClear();
    mockSignInWithPopup.mockClear();
    mockSignOut.mockClear();
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
  });

  /**
   * @describe Scenario: Given the user is not authenticated.
   */
  describe('given the user is not authenticated', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: null, loading: false });
    });

    /**
     * @it It should render a "Login with Google" button.
     */
    it('should render a "Login with Google" button', () => {
      render(<AuthButton />);
      expect(screen.getByRole('button', { name: /Login com Google/i })).toBeInTheDocument();
    });

    /**
     * @it It should call signInWithPopup and navigate to the home page on successful login.
     */
    it('should call signInWithPopup and navigate to the home page on successful login', async () => {
      const user = userEvent.setup();
      mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'test-uid' } });
      render(<AuthButton />);

      const loginButton = screen.getByRole('button', { name: /Login com Google/i });
      await user.click(loginButton);

      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);

      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/'));
    });

    /**
     * @it It should handle login errors gracefully (e.g., popup closed by user).
     */
    it('should handle login errors gracefully (e.g., popup closed by user)', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mockSignInWithPopup.mockRejectedValueOnce(new Error('Popup closed by user'));
      render(<AuthButton />);

      await user.click(screen.getByRole('button', { name: /Login com Google/i }));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Erro no login com Google:',
          expect.any(Error)
        );
      });

      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
      consoleErrorSpy.mockRestore();
    });
  });

  /**
   * @describe Scenario: Given the user is authenticated.
   */
  describe('given the user is authenticated', () => {
    const mockUser = {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'http://example.com/avatar.jpg',
    };

    beforeEach(() => {
      useAuth.mockReturnValue({ user: mockUser, loading: false });
    });

    /**
     * @it It should render a dropdown trigger with user avatar and name.
     */
    it('should render a dropdown trigger with user avatar and name', () => {
      render(<AuthButton />);
      expect(screen.getByText(mockUser.displayName.split(' ')[0])).toBeInTheDocument(); // Assuming AuthButton shows first name
    });

    /**
     * @describe Context: When the user dropdown menu is opened.
     */
    describe('when the user dropdown menu is opened', () => {
      beforeEach(async () => {
        const user = userEvent.setup();
        render(<AuthButton />);
        const triggerButton = screen.getByText(mockUser.displayName.split(' ')[0]);
        await user.click(triggerButton);
        await screen.findByTestId('auth-dropdown-menu'); // Ensure menu is open
      });

      /**
       * @it It should display user display name and email.
       */
      it('should display user display name and email', () => {
        const menu = screen.getByTestId('auth-dropdown-menu');
        expect(within(menu).getByText(mockUser.displayName)).toBeInTheDocument();
        expect(within(menu).getByText(mockUser.email)).toBeInTheDocument();
      });

      /**
       * @it It should display a "Settings" menu item.
       */
      it('should display a "Settings" menu item', () => {
        const menu = screen.getByTestId('auth-dropdown-menu');
        expect(within(menu).getByRole('menuitem', { name: /Configurações/i })).toBeInTheDocument();
      });

      /**
       * @it It should display a "Logout" menu item.
       */
      it('should display a "Logout" menu item', () => {
        const menu = screen.getByTestId('auth-dropdown-menu');
        expect(within(menu).getByRole('menuitem', { name: /Sair/i })).toBeInTheDocument();
      });
    });

    /**
     * @it It should call signOut and navigate to the login page when "Logout" is clicked.
     */
    it('should call signOut and navigate to the login page when "Logout" is clicked', async () => {
      const user = userEvent.setup();
      mockSignOut.mockResolvedValueOnce(undefined);
      render(<AuthButton />);

      const triggerButton = screen.getByText(mockUser.displayName.split(' ')[0]);
      await user.click(triggerButton);

      const menu = await screen.findByTestId('auth-dropdown-menu');
      const logoutButton = within(menu).getByRole('menuitem', { name: /Sair/i });
      await user.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledWith(auth);

      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/login'));
    });

    /**
     * @it It should handle logout errors gracefully.
     */
    it('should handle logout errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mockSignOut.mockRejectedValueOnce(new Error('Sign out failed'));
      render(<AuthButton />);

      await user.click(screen.getByText(mockUser.displayName.split(' ')[0]));
      const menu = await screen.findByTestId('auth-dropdown-menu');
      const logoutButton = within(menu).getByRole('menuitem', { name: /Sair/i });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Erro no logout:', expect.any(Error));
      });
      expect(mockSignOut).toHaveBeenCalledWith(auth);
      consoleErrorSpy.mockRestore();
    });

    /**
     * @it It should handle clicking the "Settings" menu item (currently no navigation).
     */
    it('should handle clicking the "Settings" menu item (currently no navigation)', async () => {
      const user = userEvent.setup();
      render(<AuthButton />);

      const triggerButton = screen.getByText(mockUser.displayName.split(' ')[0]);
      await user.click(triggerButton);

      const menu = await screen.findByTestId('auth-dropdown-menu');
      const settingsButton = await within(menu).findByRole('menuitem', { name: /Configurações/i });

      // The item is found, now click it
      await user.click(settingsButton);

      // Test passes if the above lines do not throw an error.
      // Clicking the item is expected to close the menu, so it won't be in the document afterwards.
      // The purpose of this test is to ensure the click action itself is handled without error.
    });
  });
});
