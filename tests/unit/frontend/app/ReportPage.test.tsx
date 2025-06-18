import React from 'react';

import { render } from '@testing-library/react';

import ReportPage from '@/app/report/[analysisId]/page';

jest.mock('next-mdx-remote', () => ({
  MDXRemote: (props: { source: string }) => <div>{props.source}</div>,
}));

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

describe('ReportPage', () => {
  it('renders without crashing', () => {
    render(<ReportPage />);
  });
});
