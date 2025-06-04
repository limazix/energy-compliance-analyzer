
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import HomePage from './page';
import { useAuth as originalUseAuth } from '@/contexts/auth-context';
import { useAnalysisManager as originalUseAnalysisManager } from '@/hooks/useAnalysisManager';
import { useFileUploadManager as originalUseFileUploadManager } from '@/features/file-upload/hooks/useFileUploadManager';
import type { Analysis } from '@/types/analysis';
import { Timestamp } from 'firebase/firestore';

// Mocks
jest.mock('@/contexts/auth-context', () => ({
  __esModule: true,
  ...jest.requireActual('@/contexts/auth-context'),
  useAuth: jest.fn(),
}));
const useAuth = originalUseAuth as jest.Mock;

jest.mock('@/hooks/useAnalysisManager');
const useAnalysisManager = originalUseAnalysisManager as jest.Mock;

jest.mock('@/features/file-upload/hooks/useFileUploadManager');
const useFileUploadManager = originalUseFileUploadManager as jest.Mock;

// Server action mocks are in jest.setup.js

const mockRouterReplace = jest.requireMock('next/navigation').useRouter().replace;
const mockRouterPush = jest.requireMock('next/navigation').useRouter().push;

// Updated to match firebase-emulator-data/auth_export/accounts.json
const mockUser = {
  uid: 'test-user-001',
  displayName: 'Test User One',
  email: 'test@example.com',
  photoURL: 'https://placehold.co/100x100.png?text=TU1'
};

// Updated to match firebase-emulator-data/firestore_export/firestore_export.json for analysis-id-completed-01
const mockAnalysisItemCompleted: Analysis = {
  id: 'analysis-id-completed-01',
  userId: mockUser.uid,
  fileName: 'aneel_data_report_alpha.csv',
  title: 'Relatório de Conformidade Alpha',
  description: 'Análise detalhada dos dados de qualidade de energia para o cliente Alpha.',
  languageCode: 'pt-BR',
  status: 'completed',
  progress: 100,
  uploadProgress: 100,
  powerQualityDataUrl: `user_uploads/${mockUser.uid}/analysis-id-completed-01/aneel_data_report_alpha.csv`,
  powerQualityDataSummary: 'Sumário dos dados para Alpha: Tensão estável, algumas flutuações de frequência.',
  isDataChunked: false,
  identifiedRegulations: ['REN 414/2010', 'PRODIST Módulo 8'],
  summary: 'Conformidade geral atingida com pequenas observações.',
  structuredReport: {
    reportMetadata: {
      title: 'Relatório de Conformidade da Qualidade de Energia Elétrica - Alpha',
      subtitle: 'Análise referente ao arquivo aneel_data_report_alpha.csv',
      author: 'Energy Compliance Analyzer',
      generatedDate: '2023-10-26',
    },
    tableOfContents: ["Introdução", "Análise de Tensão", "Conclusões"],
    introduction: {
      objective: 'Analisar a conformidade dos dados de qualidade de energia do arquivo aneel_data_report_alpha.csv.',
      overallResultsSummary: 'A análise indica conformidade geral com as normas ANEEL, com algumas variações de frequência necessitando monitoramento.',
      usedNormsOverview: 'REN 414/2010, PRODIST Módulo 8',
    },
    analysisSections: [
      {
        title: "Análise de Tensão",
        content: "Os níveis de tensão mantiveram-se dentro dos limites adequados na maior parte do tempo.",
        insights: ["Tensão predominantemente estável."],
        relevantNormsCited: ["PRODIST Módulo 8, Seção 3.2"],
        chartOrImageSuggestion: "Gráfico de linha da tensão ao longo do tempo."
      }
    ],
    finalConsiderations: 'Recomenda-se o monitoramento contínuo da frequência.',
    bibliography: [{ text: 'ANEEL. PRODIST Módulo 8 - Qualidade da Energia Elétrica.', link: 'https://www.aneel.gov.br' }],
  },
  mdxReportStoragePath: `user_reports/${mockUser.uid}/analysis-id-completed-01/report.mdx`,
  errorMessage: undefined,
  tags: ['cliente_alpha', 'prioridade_alta'],
  createdAt: new Date('2023-10-25T10:00:00Z').toISOString(),
  completedAt: new Date('2023-10-26T14:30:00Z').toISOString(),
};

// Updated to match firebase-emulator-data/firestore_export/firestore_export.json for analysis-id-inprogress-02
const mockAnalysisItemInProgress: Analysis = {
  id: 'analysis-id-inprogress-02',
  userId: mockUser.uid,
  fileName: 'power_quality_beta_set.csv',
  title: 'Análise Beta em Andamento',
  description: 'Processamento em tempo real dos dados do cliente Beta.',
  languageCode: 'pt-BR',
  status: 'summarizing_data',
  progress: 30,
  uploadProgress: 100,
  powerQualityDataUrl: `user_uploads/${mockUser.uid}/analysis-id-inprogress-02/power_quality_beta_set.csv`,
  powerQualityDataSummary: undefined,
  isDataChunked: true,
  identifiedRegulations: undefined,
  summary: undefined,
  structuredReport: undefined,
  mdxReportStoragePath: undefined,
  errorMessage: undefined,
  tags: ['cliente_beta', 'realtime'],
  createdAt: new Date('2023-10-27T09:00:00Z').toISOString(),
  completedAt: undefined,
};


describe('HomePage - Navigation and Views', () => {
  let mockSetCurrentAnalysis: jest.Mock;
  let mockFetchPastAnalyses: jest.Mock;
  let mockStartAiProcessing: jest.Mock;
  let mockUploadFileAndCreateRecord: jest.Mock;
  let mockHandleDeleteAnalysis: jest.Mock;
  let mockHandleCancelAnalysis: jest.Mock;

  beforeEach(() => {
    // Reset all navigation mocks
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();

    // Setup hook mocks
    mockSetCurrentAnalysis = jest.fn();
    mockFetchPastAnalyses = jest.fn().mockResolvedValue(undefined);
    mockStartAiProcessing = jest.fn().mockResolvedValue(undefined);
    mockUploadFileAndCreateRecord = jest.fn().mockResolvedValue({
      analysisId: 'new-analysis-id',
      fileName: 'new-file.csv',
      error: null,
    });
    mockHandleDeleteAnalysis = jest.fn((id, cb) => { cb?.(); return Promise.resolve(); });
    mockHandleCancelAnalysis = jest.fn().mockResolvedValue(undefined);

    useAuth.mockReturnValue({ user: mockUser, loading: false });
    
    // Use a fresh mock object for each test to avoid interference
    const currentMockAnalysisManagerValue = {
      currentAnalysis: null,
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: [], // Default to empty, specific tests will override
      isLoadingPastAnalyses: false,
      tagInput: '',
      setTagInput: jest.fn(),
      fetchPastAnalyses: mockFetchPastAnalyses,
      startAiProcessing: mockStartAiProcessing,
      handleAddTag: jest.fn(),
      handleRemoveTag: jest.fn(),
      handleDeleteAnalysis: mockHandleDeleteAnalysis,
      handleCancelAnalysis: mockHandleCancelAnalysis,
      downloadReportAsTxt: jest.fn(),
      displayedAnalysisSteps: [],
    };
    useAnalysisManager.mockReturnValue(currentMockAnalysisManagerValue);

    useFileUploadManager.mockReturnValue({
      fileToUpload: null,
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      handleFileSelection: jest.fn(),
      uploadFileAndCreateRecord: mockUploadFileAndCreateRecord,
    });

    // getPastAnalysesAction is mocked globally in jest.setup.js
    // If EMULATORS_CONNECTED, it's unmocked. Otherwise, it returns Promise.resolve([]).
    // Tests here will rely on useAnalysisManager's `pastAnalyses` being set correctly for UI.

    const { getAnalysisReportAction } = jest.requireMock('@/features/report-viewing/actions/reportViewingActions');
    getAnalysisReportAction.mockResolvedValue({ // This remains mocked as Storage isn't seeded
        mdxContent: `# Test Report for ${mockAnalysisItemCompleted.id}`,
        fileName: mockAnalysisItemCompleted.fileName,
        analysisId: mockAnalysisItemCompleted.id,
        error: null,
    });
  });

  test('redirects to /login if user is not authenticated', async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    render(<HomePage />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('renders default view (Past Analyses Accordion) for authenticated user, including AppHeader with "Nova Análise" button', () => {
    // Ensure getPastAnalysesAction (if unmocked) doesn't throw due to missing user.uid in its mock
    // This test relies on the global mock of getPastAnalysesAction if emulators are not connected.
    // If emulators are connected, it should hit the emulator.
    // The UI will show "Nenhuma análise" if pastAnalyses in useAnalysisManager is empty.
    useAnalysisManager.mockReturnValue({
      ...global.mockUseAnalysisManagerReturnValue,
      fetchPastAnalyses: mockFetchPastAnalyses.mockResolvedValue(undefined),
      pastAnalyses: [], // Explicitly empty for this render
    });

    render(<HomePage />);
    // Check for AppHeader content specific to authenticated user
    expect(screen.getByRole('button', { name: /Nova Análise/i })).toBeInTheDocument(); 
    // Check for HomePage specific content
    expect(screen.getByText(`Suas Análises Anteriores`)).toBeInTheDocument();
  });

  test('navigates to NewAnalysisForm when "Nova Análise" is clicked and back to Dashboard on cancel', () => {
    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    expect(screen.getByText('Nova Análise de Conformidade')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar e Iniciar Análise/i})).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.getByText('Suas Análises Anteriores')).toBeInTheDocument();
  });

  test('displays past analyses from seed data in accordion and expands to show AnalysisView', async () => {
    // Simulate that useAnalysisManager.fetchPastAnalyses populates pastAnalyses with seeded data
    const mockPastAnalysesFromSeed = [mockAnalysisItemCompleted, mockAnalysisItemInProgress];
    useAnalysisManager.mockReturnValue({
      ...global.mockUseAnalysisManagerReturnValue, // Use the base from jest.setup.js
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: mockPastAnalysesFromSeed, // Data consistent with seed
      fetchPastAnalyses: mockFetchPastAnalyses.mockImplementation(async () => {
        // In a real scenario with unmocked getPastAnalysesAction, this would fetch from emulator.
        // Here, we ensure the test uses the seeded data structure.
        (useAnalysisManager.mock.results[0].value as any).pastAnalyses = mockPastAnalysesFromSeed;
        return Promise.resolve(undefined);
      }),
    });
    
    render(<HomePage />);

    // Trigger fetch (though it's mocked to directly set pastAnalyses for this test)
    await act(async () => {
      await useAnalysisManager.mock.results[0].value.fetchPastAnalyses();
    });
    
    // Re-render might be needed if the hook updates state that HomePage relies on for list
    // Forcing a re-render or finding a more robust way to wait for list update
    // However, with direct mockReturnValue, it should render with this data.

    await waitFor(() => {
      expect(screen.getByText(mockAnalysisItemCompleted.title!)).toBeInTheDocument();
      expect(screen.getByText(mockAnalysisItemInProgress.title!)).toBeInTheDocument();
    });

    const completedAnalysisAccordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    fireEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
      expect(mockSetCurrentAnalysis).toHaveBeenCalledWith(mockAnalysisItemCompleted);
    });
    
    // Simulate currentAnalysis is now set in the hook's return value
    useAnalysisManager.mockReturnValueOnce({
      ...global.mockUseAnalysisManagerReturnValue,
      currentAnalysis: mockAnalysisItemCompleted, // IMPORTANT: set currentAnalysis
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: mockPastAnalysesFromSeed,
      fetchPastAnalyses: mockFetchPastAnalyses,
      displayedAnalysisSteps: calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted),
    });
    
    // Re-render or wait for component to update with new currentAnalysis
    await waitFor(() => {
        const analysisViewTitle = screen.getByText(new RegExp(mockAnalysisItemCompleted.title!, 'i'));
        expect(analysisViewTitle).toBeInTheDocument();
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Visualizar Relatório Detalhado/i})).toBeInTheDocument();
    });
  });

  test('navigates to ReportPage when "Visualizar Relatório Detalhado" is clicked', async () => {
     useAnalysisManager.mockReturnValue({
      ...global.mockUseAnalysisManagerReturnValue,
      currentAnalysis: mockAnalysisItemCompleted,
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: [mockAnalysisItemCompleted],
      displayedAnalysisSteps: calculateDisplayedAnalysisSteps(mockAnalysisItemCompleted),
    });

    render(<HomePage />);
    
    const completedAnalysisAccordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    fireEvent.click(completedAnalysisAccordionTrigger);

    await waitFor(() => {
        expect(screen.getByText(/Análise Concluída com Sucesso!/i)).toBeInTheDocument();
    });

    const viewReportButton = screen.getByRole('button', { name: /Visualizar Relatório Detalhado/i });
    fireEvent.click(viewReportButton);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/report/${mockAnalysisItemCompleted.id}`);
    });
  });

  test('simulates file upload and navigates to AnalysisView for the new analysis', async () => {
    const newFileName = 'uploaded-test-file.csv';
    const newAnalysisId = `mock-analysis-id-for-${newFileName}`;
    const newAnalysisTitle = 'Freshly Uploaded Analysis';

    const mockNewAnalysisData: Analysis = {
      id: newAnalysisId,
      userId: mockUser.uid,
      fileName: newFileName,
      title: newAnalysisTitle,
      status: 'summarizing_data', 
      progress: 10,
      uploadProgress: 100,
      createdAt: new Date().toISOString(),
      tags: [],
    };
    
    const handleFileSelectionMock = jest.fn();
    useFileUploadManager.mockReturnValue({
      fileToUpload: new File(['col1,col2\nval1,val2'], newFileName, { type: 'text/csv' }),
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      handleFileSelection: handleFileSelectionMock,
      uploadFileAndCreateRecord: mockUploadFileAndCreateRecord.mockResolvedValue({
        analysisId: newAnalysisId,
        fileName: newFileName,
        title: newAnalysisTitle,
        error: null,
      }),
    });

     const setCurrentAnalysisForUpload = jest.fn();
     const startAiProcessingForUpload = jest.fn().mockResolvedValue(undefined);
     useAnalysisManager.mockReturnValue({
        ...global.mockUseAnalysisManagerReturnValue,
        setCurrentAnalysis: setCurrentAnalysisForUpload,
        startAiProcessing: startAiProcessingForUpload,
        fetchPastAnalyses: mockFetchPastAnalyses.mockResolvedValue(undefined), 
     });

    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /Nova Análise/i }));
    await screen.findByText('Nova Análise de Conformidade');
    
    const titleInput = screen.getByLabelText(/Título da Análise/i);
    fireEvent.change(titleInput, { target: { value: newAnalysisTitle } });

    const submitButton = screen.getByRole('button', { name: /Enviar e Iniciar Análise/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    await waitFor(() => {
      expect(mockUploadFileAndCreateRecord).toHaveBeenCalledWith(
        mockUser, 
        newAnalysisTitle, 
        '', 
        expect.any(String) 
      );
    });
    
    await waitFor(() => {
      expect(setCurrentAnalysisForUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          id: newAnalysisId,
          fileName: newFileName,
          title: newAnalysisTitle,
        })
      );
    });

    await waitFor(() => {
        expect(startAiProcessingForUpload).toHaveBeenCalledWith(newAnalysisId, mockUser.uid);
    });
    
    useAnalysisManager.mockReturnValueOnce({
      ...global.mockUseAnalysisManagerReturnValue,
      currentAnalysis: { 
          ...mockNewAnalysisData,
          createdAt: new Date(mockNewAnalysisData.createdAt).toISOString(), 
      },
      setCurrentAnalysis: setCurrentAnalysisForUpload,
      startAiProcessing: startAiProcessingForUpload,
      displayedAnalysisSteps: calculateDisplayedAnalysisSteps(mockNewAnalysisData),
      fetchPastAnalyses: mockFetchPastAnalyses.mockResolvedValue(undefined),
    });

    await waitFor(() => {
      const analysisViewForNew = screen.getByText(new RegExp(newAnalysisTitle, "i"));
      expect(analysisViewForNew).toBeInTheDocument();
      expect(screen.getByText(/Sumarizando Dados da Qualidade de Energia/i)).toBeInTheDocument(); 
    });
  });

  test('can delete an analysis from the AnalysisView', async () => {
    useAnalysisManager.mockReturnValue({
      ...global.mockUseAnalysisManagerReturnValue,
      currentAnalysis: mockAnalysisItemCompleted,
      setCurrentAnalysis: mockSetCurrentAnalysis,
      pastAnalyses: [mockAnalysisItemCompleted],
      fetchPastAnalyses: mockFetchPastAnalyses,
      handleDeleteAnalysis: mockHandleDeleteAnalysis, 
    });

    render(<HomePage />);

    const accordionTrigger = screen.getByText(mockAnalysisItemCompleted.title!);
    fireEvent.click(accordionTrigger);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Excluir Análise/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Excluir Análise/i }));

    await waitFor(() => {
      expect(screen.getByText('Confirmar Exclusão')).toBeInTheDocument();
    });
    const confirmButton = screen.getByRole('button', { name: 'Confirmar Exclusão' });
    
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockHandleDeleteAnalysis).toHaveBeenCalledWith(mockAnalysisItemCompleted.id, expect.any(Function));
    });
    await waitFor(() => {
        expect(mockFetchPastAnalyses).toHaveBeenCalled();
    });
  });

});

// Helper to calculate displayed steps, mirroring the hook's logic for tests
function calculateDisplayedAnalysisSteps(analysis: Analysis | null): any[] {
  if (!analysis) return [];
  // This is a simplified version for test setup.
  // Refer to the actual implementation in `useAnalysisManager` or its utils for accuracy.
  const steps = [
    { name: "Upload do Arquivo e Preparação", status: "pending", progress: 0 },
    { name: "Sumarizando Dados da Qualidade de Energia", status: "pending", progress: 0 },
    // ... other steps
  ];
  if (analysis.status === 'completed') {
    return steps.map(s => ({ ...s, status: 'completed', progress: 100 }));
  }
  if (analysis.status === 'summarizing_data') {
    steps[0].status = 'completed';
    steps[0].progress = 100;
    steps[1].status = 'in_progress';
    steps[1].progress = analysis.progress; // Or a calculated value
    return steps;
  }
  // Add more cases as needed
  return steps;
}
