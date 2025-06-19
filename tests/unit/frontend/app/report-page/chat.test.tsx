import React from 'react';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
      structuredReport: {},
    })
  ),
}));

jest.mock('@/features/report-chat/actions/reportChatActions', () => ({
  askReportOrchestratorAction: jest.fn(() => Promise.resolve({})),
}));

describe('Given the ReportPage is rendered', () => {
  describe('when the user types in the chat and clicks send', () => {
    it('should send a message', async () => {
      render(<ReportPage />);
      await waitFor(() => {
        expect(screen.getByText('# Report')).toBeInTheDocument();
      });

      const chatInput = screen.getByRole('textbox', { name: /user input/i });
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(chatInput, { target: { value: 'Hello' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });
    });
  });
});
