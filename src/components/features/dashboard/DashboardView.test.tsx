
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('calls onStartNewAnalysis when "Iniciar Nova Análise" button is clicked', async () => {
    render(
      <DashboardView
        userName={mockUserName}
        onStartNewAnalysis={mockOnStartNewAnalysis}
        isLoadingPastAnalyses={false}
      />
    );
    const startButton = screen.getByRole('button', { name: /Iniciar Nova Análise/i });
    await userEvent.click(startButton);
    expect(mockOnStartNewAnalysis).toHaveBeenCalledTimes(1);
  });

  it('renders correctly when isLoadingPastAnalyses is true (no visual change currently)', () => {
    render(
      <DashboardView
        userName={mockUserName}
        onStartNewAnalysis={mockOnStartNewAnalysis}
        isLoadingPastAnalyses={true}
      />
    );
    expect(screen.getByText(`Bem-vindo(a), ${mockUserName}!`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Nova Análise/i })).toBeInTheDocument();
  });
});
