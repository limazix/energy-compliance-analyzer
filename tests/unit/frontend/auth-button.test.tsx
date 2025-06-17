/**
 * @fileoverview Test suite for the AuthButton component.
 * This file contains tests to verify the AuthButton's behavior for both
 * authenticated and unauthenticated users, including login actions and UI rendering,
 * structured in BDD style.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWithPopup } from 'firebase/auth'; // signOut is no longer used here

import { AuthButton } from '@/components/auth-button';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { auth, googleProvider } from '@/lib/firebase';

import type { User } from 'firebase/auth';

// Mock useAuth hook
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

// Mock firebase/auth module for specific functions
jest.mock('firebase/auth', () => {
  const actualFirebaseAuth = jest.requireActual('firebase/auth');
  return {
    ...actualFirebaseAuth,
    signInWithPopup: jest.fn(),
    // signOut is no longer mocked here as it's not used by AuthButton
    GoogleAuthProvider: actualFirebaseAuth.GoogleAuthProvider,
  };
});

const mockSignInWithPopup = signInWithPopup as jest.Mock;

// Mock Next.js router
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
 * It covers rendering the correct button (login or user info)
 * based on authentication state and handling login interactions, following BDD principles.
 */
describe('AuthButton component', () => {
  beforeEach(() => {
    useAuth.mockClear();
    mockSignInWithPopup.mockClear();
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
      const userEvt = userEvent.setup();
      mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'test-uid' } });
      render(<AuthButton />);

      const loginButton = screen.getByRole('button', { name: /Login com Google/i });
      await userEvt.click(loginButton);

      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
      expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
      await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/'));
    });

    /**
     * @it It should handle login errors gracefully.
     */
    it('should handle login errors gracefully', async () => {
      const userEvt = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mockSignInWithPopup.mockRejectedValueOnce(new Error('Popup closed by user'));
      render(<AuthButton />);

      const loginButton = screen.getByRole('button', { name: /Login com Google/i });
      await userEvt.click(loginButton);

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
      displayName: 'Test User FullName',
      email: 'test@example.com',
      photoURL: 'http://example.com/avatar.jpg',
    } as User;

    beforeEach(() => {
      useAuth.mockReturnValue({ user: mockUser, loading: false });
    });

    /**
     * @it It should render user avatar, full name, and email directly.
     */
    it('should render user avatar, full name, and email directly', async () => {
      render(<AuthButton />);
      expect(screen.getByText(mockUser.displayName!)).toBeInTheDocument();
      expect(screen.getByText(mockUser.email!)).toBeInTheDocument();
      const avatar = await screen.findByRole('img', { name: mockUser.displayName as string });
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', mockUser.photoURL);
    });

    /**
     * @it It should not render a dropdown trigger or menu.
     */
    it('should not render a dropdown trigger or menu', () => {
      render(<AuthButton />);
      // Check that it's not a button that opens a menu
      const userInfoContainer = screen.getByLabelText('User information');
      expect(userInfoContainer.tagName).not.toBe('BUTTON');
      expect(screen.queryByRole('button', { 'aria-haspopup': 'menu' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('auth-dropdown-menu')).not.toBeInTheDocument();
    });
  });
});
