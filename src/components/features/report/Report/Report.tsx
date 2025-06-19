import React from 'react';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { ReportChat } from '@/components/features/report/ReportChat';
import { ReportContent } from '@/components/features/report/ReportContent';
import { ReportError } from '@/components/features/report/ReportError';
import { ReportHeader } from '@/components/features/report/ReportHeader';
import { ReportLoading } from '@/components/features/report/ReportLoading';
import { ReportNotFound } from '@/components/features/report/ReportNotFound';

export function Report({
  user,
  authLoading,
  reportData,
  chatMessages,
  userInput,
  isAiResponding,
  currentLanguageCode,
  handleSendMessage,
  handleRetryFetch,
  setUserInput,
}) {
  if (authLoading || (reportData.isLoading && !reportData.error)) {
    return <ReportLoading />;
  }

  if (reportData.error) {
    return (
      <ReportError
        fileName={reportData.fileName}
        error={reportData.error}
        onRetry={handleRetryFetch}
      />
    );
  }

  if (!reportData.mdxContent) {
    return (
      <ReportNotFound
        analysisId={reportData.analysisId}
        fileName={reportData.fileName}
        onRetry={handleRetryFetch}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto py-8 px-4 flex-1">
        <ReportHeader fileName={reportData.fileName} analysisId={reportData.analysisId} />
        <ReportContent
          mdxContent={reportData.mdxContent}
          structuredReport={reportData.structuredReport}
        />
        <ReportChat
          chatMessages={chatMessages}
          userInput={userInput}
          onUserInput={setUserInput}
          onSendMessage={handleSendMessage}
          isAiResponding={isAiResponding}
          user={user}
          currentLanguageCode={currentLanguageCode}
          isReportReady={!!reportData.structuredReport}
          chatScrollAreaRef={null}
        />
      </main>
      <AppFooter />
    </div>
  );
}
