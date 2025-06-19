import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';

import ReportPage from '@/app/report/[analysisId]/page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ analysisId: '123' }),
  useRouter: () => ({}),
}));

jest.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { uid: '123' } }),
}));

jest.mock('@/features/report-viewing/actions/reportViewingActions', () => ({
  getAnalysisReportAction: jest.fn(() =>
    Promise.resolve({
      mdxContent: '# Report',
      fileName: 'report.pdf',
      analysisId: '123',
    })
  ),
}));

jest.mock('@/features/report-chat/actions/reportChatActions', () => ({
  askReportOrchestratorAction: jest.fn(() => Promise.resolve({})),
}));

describe('Given the ReportPage is rendered', () => {
  describe('when the report is loading', () => {
    it('should display a loading state', async () => {
      render(<ReportPage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    });
  });

  describe('when the report is loaded successfully', () => {
    it('should display the report content', async () => {
      render(<ReportPage />);
      await waitFor(() => {
        expect(screen.getByText('# Report')).toBeInTheDocument();
        expect(screen.getByText('report.pdf')).toBeInTheDocument();
      });
    });
  });
});
