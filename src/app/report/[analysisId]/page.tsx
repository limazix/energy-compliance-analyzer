'use client';

import { useRef } from 'react';

import { Report } from '@/components/features/report/Report/Report';
import { useAuth } from '@/contexts/auth-context';
import { useChat } from '@/hooks/useChat';
import { useReportData } from '@/hooks/useReportData';

export default function ReportPage() {
  const { user, loading: authLoading } = useAuth();
  const { reportData, fetchReportAndInitialStructuredData } = useReportData();
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const {
    chatMessages,
    userInput,
    isAiResponding,
    currentLanguageCode,
    handleSendMessage,
    setUserInput,
  } = useChat(reportData, chatScrollAreaRef);

  return (
    <Report
      user={user}
      authLoading={authLoading}
      reportData={reportData}
      chatMessages={chatMessages}
      userInput={userInput}
      isAiResponding={isAiResponding}
      currentLanguageCode={currentLanguageCode}
      handleSendMessage={handleSendMessage}
      handleRetryFetch={fetchReportAndInitialStructuredData}
      setUserInput={setUserInput}
    />
  );
}
