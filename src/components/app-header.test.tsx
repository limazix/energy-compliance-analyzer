/**
 * @fileoverview Test suite for the AppHeader component.
 * This file contains tests to ensure the AppHeader renders correctly based on user authentication status,
 * including the display of the logo, "Nova Análise" button, and the AuthButton.
 * It also tests interactions with these elements, such as click handlers, structured in BDD style.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  usePathname as originalUsePathname,
  useRouter as originalUseRouter,
} from 'next/navigation';

import { useAuth as originalUseAuth } from '@/contexts/auth-context';

import { AppHeader } from './app-header';

// Mock useAuth hook
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));
const useRouter = originalUseRouter as jest.Mock;
const usePathname = originalUsePathname as jest.Mock;

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

/**
 * @describe Test suite for the AppHeader component.
 * It covers conditional rendering based on authentication state and user interactions.
 */
describe('AppHeader component', () => {
  const mockUser = {
    uid: 'test-user-id',
    displayName: 'Test User',
    email: 'test@example.com',
    photoURL: 'http://example.com/avatar.jpg',
  };
  const mockOnStartNewAnalysis = jest.fn();
  const mockOnNavigateToDashboard = jest.fn();

  beforeEach(() => {
    useAuth.mockClear();
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
    useRouter.mockReturnValue({
      push: mockRouterPush,
      replace: mockRouterReplace,
    });
    usePathname.mockReturnValue('/'); // Default pathname
    mockOnStartNewAnalysis.mockClear();
    mockOnNavigateToDashboard.mockClear();
  });

  /**
   * @describe Scenario: Given a user is logged in.
   */
  describe('given a user is logged in', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: mockUser, loading: false });
    });

    /**
     * @it It should display the application logo.
     */
    it('should display the application logo', () => {
      render(<AppHeader />);
      expect(screen.getByAltText('EMA - Electric Magnitudes Analizer Logo')).toBeInTheDocument();
    });

    /**
     * @it It should display the "New Analysis" button.
     */
    it('should display the "New Analysis" button', () => {
      render(<AppHeader onStartNewAnalysis={mockOnStartNewAnalysis} />);
      expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument();
    });

    /**
     * @it It should call the onStartNewAnalysis callback when the "New Analysis" button is clicked and the callback is provided.
     */
    it('should call the onStartNewAnalysis callback when the "New Analysis" button is clicked and the callback is provided', async () => {
      render(<AppHeader onStartNewAnalysis={mockOnStartNewAnalysis} />);
      await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
      expect(mockOnStartNewAnalysis).toHaveBeenCalledTimes(1);
    });

    /**
     * @it It should render the "New Analysis" button as a link to "/" if the onStartNewAnalysis callback is not provided.
     */
    it('should render the "New Analysis" button as a link to "/" if the onStartNewAnalysis callback is not provided', () => {
      render(<AppHeader />);
      const newAnalysisButton = screen.getByRole('link', { name: /Nova Análise/i });
      expect(newAnalysisButton).toBeInTheDocument();
      expect(newAnalysisButton).toHaveAttribute('href', '/');
    });

    /**
     * @it It should display the AuthButton with user information (avatar/name).
     */
    it('should display the AuthButton with user information (avatar/name)', () => {
      render(<AppHeader />);
      expect(screen.getByText(mockUser.displayName.split(' ')[0])).toBeInTheDocument(); // Assuming AuthButton shows first name
    });

    /**
     * @it It should call the onNavigateToDashboard callback when the logo is clicked and the callback is provided.
     */
    it('should call the onNavigateToDashboard callback when the logo is clicked and the callback is provided', async () => {
      render(<AppHeader onNavigateToDashboard={mockOnNavigateToDashboard} />);
      await userEvent.click(screen.getByAltText('EMA - Electric Magnitudes Analizer Logo'));
      expect(mockOnNavigateToDashboard).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * @describe Scenario: Given a user is not logged in.
   */
  describe('given a user is not logged in', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: null, loading: false });
    });

    /**
     * @it It should display the application logo.
     */
    it('should display the application logo', () => {
      render(<AppHeader />);
      expect(screen.getByAltText('EMA - Electric Magnitudes Analizer Logo')).toBeInTheDocument();
    });

    /**
     * @it It should not display the "New Analysis" button.
     */
    it('should not display the "New Analysis" button', () => {
      render(<AppHeader onStartNewAnalysis={mockOnStartNewAnalysis} />);
      expect(screen.queryByRole('button', { name: /Nova Análise/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Nova Análise/i })).not.toBeInTheDocument();
    });

    /**
     * @it It should display the AuthButton prompting for login.
     */
    it('should display the AuthButton prompting for login', () => {
      render(<AppHeader />);
      expect(screen.getByRole('button', { name: /Login com Google/i })).toBeInTheDocument(); // Assuming AuthButton shows this when logged out
    });
  });
});
