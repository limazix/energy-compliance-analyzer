
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardView } from './DashboardView';

describe('DashboardView', () => {
  const mockOnStartNewAnalysis = jest.fn();
  const mockUserName = 'Tester';

  beforeEach(() => {
    mockOnStartNewAnalysis.mockClear();
  });

  it('renders welcome message with user name', () => {
    render(
      <DashboardView
        userName={mockUserName}
        onStartNewAnalysis={mockOnStartNewAnalysis}
        isLoadingPastAnalyses={false}
      />
    );
    expect(screen.getByText(`Bem-vindo(a), ${mockUserName}!`)).toBeInTheDocument();
    expect(screen.getByText('O que você gostaria de fazer hoje?')).toBeInTheDocument();
  });

  it('renders welcome message with "Usuário" if userName is null', () => {
    render(
      <DashboardView
        userName={null}
        onStartNewAnalysis={mockOnStartNewAnalysis}
        isLoadingPastAnalyses={false}
      />
    );
    expect(screen.getByText('Bem-vindo(a), Usuário!')).toBeInTheDocument();
  });

  it('renders "Iniciar Nova Análise" button', () => {
    render(
      <DashboardView
        userName={mockUserName}
        onStartNewAnalysis={mockOnStartNewAnalysis}
        isLoadingPastAnalyses={false}
      />
    );
    expect(screen.getByRole('button', { name: /Iniciar Nova Análise/i })).toBeInTheDocument();
  });

  it('calls onStartNewAnalysis when "Iniciar Nova Análise" button is clicked', () => {
    render(
      <DashboardView
        userName={mockUserName}
        onStartNewAnalysis={mockOnStartNewAnalysis}
        isLoadingPastAnalyses={false}
      />
    );
    const startButton = screen.getByRole('button', { name: /Iniciar Nova Análise/i });
    fireEvent.click(startButton);
    expect(mockOnStartNewAnalysis).toHaveBeenCalledTimes(1);
  });

  // Example for isLoadingPastAnalyses, though it's not visually represented directly in the current component
  // If a loader was shown, this test would be more meaningful.
  it('renders correctly when isLoadingPastAnalyses is true (no visual change currently)', () => {
    render(
      <DashboardView
        userName={mockUserName}
        onStartNewAnalysis={mockOnStartNewAnalysis}
        isLoadingPastAnalyses={true}
      />
    );
    // Assert that the main elements are still there
    expect(screen.getByText(`Bem-vindo(a), ${mockUserName}!`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Nova Análise/i })).toBeInTheDocument();
  });
});
