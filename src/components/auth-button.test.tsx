/**
 * @fileoverview Test suite for the AuthButton component.
 * This file contains tests to verify the AuthButton's behavior for both
 * authenticated and unauthenticated users, including login/logout actions and UI rendering,
 * structured in BDD style.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWithPopup, signOut as firebaseSignOutModule } from 'firebase/auth';

import { useAuth as originalUseAuth } from '@/contexts/auth-context'; // Renamed
import { auth, googleProvider } from '@/lib/firebase';

import { AuthButton } from './auth-button';

import type { User } from 'firebase/auth';

// Mock useAuth hook
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'), // Important to get the actual AuthProvider
  useAuth: jest.fn(), // This is what tests will override
}));
const useAuth = originalUseAuth as jest.Mock; // Cast for tests

// Mock firebase/auth module for specific functions
jest.mock('firebase/auth', () => {
  const actualFirebaseAuth = jest.requireActual('firebase/auth');
  return {
    ...actualFirebaseAuth,
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: actualFirebaseAuth.GoogleAuthProvider, // Ensure constructor is available
    // Keep other auth mocks if needed, like onAuthStateChanged for other tests
  };
});

// Type the mocks
const mockSignInWithPopup = signInWithPopup as jest.Mock;
const mockSignOut = firebaseSignOutModule as jest.Mock;

// Mock Next.js router
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'), // Import and retain original functionalities
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    // Add other router methods if your component uses them
  }),
}));

/**
 * @describe Test suite for the AuthButton component.
 * It covers rendering the correct button (login or user dropdown)
 * based on authentication state and handling login/logout interactions, following BDD principles.
 */
describe('AuthButton component', () => {
  beforeEach(() => {
    // Clear mocks before each test
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
      const userEvt = userEvent.setup(); // Renamed to avoid conflict with 'user' prop
      mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'test-uid' } }); // Simulate successful login
      render(<AuthButton />);

      const loginButton = screen.getByRole('button', { name: /Login com Google/i });
      await userEvt.click(loginButton);

      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);

      // Wait for navigation to be called
      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/'));
    });

    /**
     * @it It should handle login errors gracefully (e.g., popup closed by user).
     */
    it('should handle login errors gracefully (e.g., popup closed by user)', async () => {
      const userEvt = userEvent.setup(); // Renamed
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined); // Suppress console.error for this test
      mockSignInWithPopup.mockRejectedValueOnce(new Error('Popup closed by user')); // Simulate login failure
      render(<AuthButton />);

      const loginButton = screen.getByRole('button', { name: /Login com Google/i });
      await userEvt.click(loginButton);

      // Check if console.error was called (as the component logs the error)
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Erro no login com Google:',
          expect.any(Error)
        );
      });

      // Ensure signInWithPopup was still called correctly
      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
      consoleErrorSpy.mockRestore(); // Restore original console.error
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
    } as User; // Cast to User type

    beforeEach(() => {
      useAuth.mockReturnValue({ user: mockUser, loading: false });
    });

    /**
     * @it It should render a dropdown trigger with user avatar and name.
     */
    it('should render a dropdown trigger with user avatar and name', async () => {
      render(<AuthButton />);
      expect(screen.getByText(mockUser.displayName!.split(' ')[0])).toBeInTheDocument();
      // Check for avatar presence by its alt text
      const avatar = await screen.findByRole('img', { name: mockUser.displayName as string });
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', mockUser.photoURL);
    });

    /**
     * @describe Context: When the user dropdown menu is opened.
     */
    describe('when the user dropdown menu is opened', () => {
      beforeEach(async () => {
        const userEvt = userEvent.setup(); // Renamed
        render(<AuthButton />);
        const triggerButton = screen.getByText(mockUser.displayName!.split(' ')[0]);
        await userEvt.click(triggerButton);
        await screen.findByTestId('auth-dropdown-menu'); // Ensure menu is open by its data-testid
      });

      /**
       * @it It should display user display name and email.
       */
      it('should display user display name and email', () => {
        const menu = screen.getByTestId('auth-dropdown-menu');
        expect(within(menu).getByText(mockUser.displayName!)).toBeInTheDocument();
        expect(within(menu).getByText(mockUser.email!)).toBeInTheDocument();
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
      const userEvt = userEvent.setup(); // Renamed
      mockSignOut.mockResolvedValueOnce(undefined); // Simulate successful sign out
      render(<AuthButton />);

      // Open the dropdown
      const triggerButton = screen.getByText(mockUser.displayName!.split(' ')[0]);
      await userEvt.click(triggerButton);

      // Find and click the logout button
      const menu = await screen.findByTestId('auth-dropdown-menu');
      const logoutButton = within(menu).getByRole('menuitem', { name: /Sair/i });
      await userEvt.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledWith(auth);

      // Wait for navigation to login page
      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/login'));
    });

    /**
     * @it It should handle logout errors gracefully.
     */
    it('should handle logout errors gracefully', async () => {
      const userEvt = userEvent.setup(); // Renamed
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mockSignOut.mockRejectedValueOnce(new Error('Sign out failed')); // Simulate sign out failure
      render(<AuthButton />);

      await userEvt.click(screen.getByText(mockUser.displayName!.split(' ')[0]));
      const menu = await screen.findByTestId('auth-dropdown-menu');
      const logoutButton = within(menu).getByRole('menuitem', { name: /Sair/i });
      await userEvt.click(logoutButton);

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
      const userEvt = userEvent.setup(); // Renamed
      render(<AuthButton />);

      const triggerButton = screen.getByText(mockUser.displayName!.split(' ')[0]);
      await userEvt.click(triggerButton);

      const menu = await screen.findByTestId('auth-dropdown-menu');
      const settingsButton = await within(menu).findByRole('menuitem', { name: /Configurações/i });

      // The item is found, now click it
      await userEvt.click(settingsButton);
      // No assertion needed here after the click if it doesn't navigate or cause other side effects
      // The test already confirms the button can be found and clicked without error.
    });
  });
});
