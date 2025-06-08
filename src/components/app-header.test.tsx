
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from './app-header';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useRouter as originalUseRouter, usePathname as originalUsePathname } from 'next/navigation';

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

describe('AppHeader', () => {
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
    usePathname.mockReturnValue('/');
    mockOnStartNewAnalysis.mockClear();
    mockOnNavigateToDashboard.mockClear();
  });

  describe('When user is logged in', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: mockUser, loading: false });
    });

    it('renders the logo', () => {
      render(<AppHeader />);
      expect(screen.getByAltText('EMA - Electric Magnitudes Analizer Logo')).toBeInTheDocument();
    });

    it('renders the "Nova Análise" button', () => {
      render(<AppHeader onStartNewAnalysis={mockOnStartNewAnalysis} />);
      expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument();
    });

    it('calls onStartNewAnalysis when "Nova Análise" button is clicked (if prop provided)', async () => {
      render(<AppHeader onStartNewAnalysis={mockOnStartNewAnalysis} />);
      await userEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
      expect(mockOnStartNewAnalysis).toHaveBeenCalledTimes(1);
    });

    it('renders "Nova Análise" button as a Link if onStartNewAnalysis is not provided', () => {
      render(<AppHeader />);
      const newAnalysisButton = screen.getByRole('link', { name: /Nova Análise/i });
      expect(newAnalysisButton).toBeInTheDocument();
      expect(newAnalysisButton).toHaveAttribute('href', '/');
    });

    it('renders the AuthButton (showing user avatar/name)', () => {
      render(<AppHeader />);
      expect(screen.getByText(mockUser.displayName.split(' ')[0])).toBeInTheDocument();
    });
  });

  describe('When user is not logged in', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: null, loading: false });
    });

    it('renders the logo', () => {
      render(<AppHeader />);
      expect(screen.getByAltText('EMA - Electric Magnitudes Analizer Logo')).toBeInTheDocument();
    });

    it('does NOT render the "Nova Análise" button', () => {
      render(<AppHeader onStartNewAnalysis={mockOnStartNewAnalysis} />);
      expect(screen.queryByRole('button', { name: /Nova Análise/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Nova Análise/i })).not.toBeInTheDocument();
    });

    it('renders the AuthButton (showing login)', () => {
      render(<AppHeader />);
      expect(screen.getByRole('button', { name: /Login com Google/i })).toBeInTheDocument();
    });
  });

  it('calls onNavigateToDashboard when logo is clicked (if prop provided)', async () => {
    useAuth.mockReturnValue({ user: mockUser, loading: false });
    render(<AppHeader onNavigateToDashboard={mockOnNavigateToDashboard} />);
    await userEvent.click(screen.getByAltText('EMA - Electric Magnitudes Analizer Logo'));
    expect(mockOnNavigateToDashboard).toHaveBeenCalledTimes(1);
  });
});
