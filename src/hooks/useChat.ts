'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { off, onValue, push, ref, serverTimestamp } from 'firebase/database';
import { useParams } from 'next/navigation';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { APP_CONFIG } from '@/config/appConfig';
import { useAuth } from '@/contexts/auth-context';
import { askReportOrchestratorAction } from '@/features/report-chat/actions/reportChatActions';
import { useToast } from '@/hooks/use-toast';
import { rtdb } from '@/lib/firebase';
import type { AnalysisData, ChatMessage } from '@/types/analysis';

interface ReportDataHook {
  isLoading: boolean;
  error: Error | null;
  fileName: string | undefined;
  structuredReport: AnalyzeComplianceReportOutput | null;
  mdxContent: string | null;
  analysis: AnalysisData | null; // Assuming you might need access to the full analysis data
}

export function useChat(reportData: ReportDataHook, chatScrollAreaRef: RefObject<HTMLElement>) {
  const params = useParams();
  const analysisId = params.analysisId as string;
  const { toast } = useToast();
  const { user } = useAuth();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);

  useEffect(() => {
    if (!user || !analysisId) return;

    const chatRef = ref(rtdb, `chats/${analysisId}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      const loadedMessages: ChatMessage[] = [];
      if (data) {
        for (const key in data) {
          loadedMessages.push({ id: key, ...data[key] });
        }
        loadedMessages.sort((a, b) => a.timestamp - b.timestamp);
      }

      setChatMessages(loadedMessages);

      if (
        loadedMessages.length === 0 &&
        !reportData.isLoading &&
        !reportData.error &&
        reportData.fileName
      ) {
        const welcomeMessageExists = loadedMessages.some((msg) =>
          msg.text.startsWith('Olá! Sou seu assistente para este relatório')
        );
        if (!welcomeMessageExists) {
          const welcomeMessagePayload = {
            sender: 'ai' as const,
            text: `Olá! Sou seu assistente para este relatório (${
              reportData.fileName || 'Relatório'
            }). Como posso ajudar você a entender ou refinar este documento?`,
            timestamp: serverTimestamp(),
          };
          push(chatRef, welcomeMessagePayload);
        }
      }
    });

    return () => {
      // Removed unused variable unsubscribe here
      off(chatRef);
    };
  }, [user, analysisId, reportData]);

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      const scrollElement = chatScrollAreaRef.current.querySelector(
        'div[data-radix-scroll-area-viewport]'
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [chatMessages, chatScrollAreaRef]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || !user || !reportData.fileName) {
      if (!userInput.trim()) {
        toast({
          title: 'Entrada vazia',
          description: 'Por favor, digite sua pergunta.',
          variant: 'destructive',
        });
      }
      return;
    }
    if (isAiResponding) {
      toast({
        title: 'Aguarde',
        description: 'A IA ainda está processando a solicitação anterior.',
        variant: 'default',
      });
      return;
    }
    if (!reportData.structuredReport) {
      toast({
        title: 'Relatório não Sincronizado',
        description:
          'O relatório estruturado não está disponível para interação ou revisão. Tente recarregar.',
        variant: 'destructive',
      });
      return;
    }
    if (!reportData.mdxContent) {
      toast({
        title: 'Conteúdo do Relatório Ausente',
        description: 'O conteúdo MDX do relatório não está carregado.',
        variant: 'destructive',
      });
      return;
    }

    const userMessageText = userInput.trim();
    setUserInput('');
    setIsAiResponding(true);

    const userMessageForRtdb = {
      sender: 'user' as const,
      text: userMessageText,
      timestamp: serverTimestamp(),
    };
    const chatRef = ref(rtdb, `chats/${analysisId}`);
    try {
      await push(chatRef, userMessageForRtdb);
    } catch (dbError) {
      // eslint-disable-next-line no-console
      console.error('Failed to push user message to RTDB:', dbError);
      toast({
        title: 'Erro ao Enviar',
        description: 'Não foi possível enviar sua mensagem.',
        variant: 'destructive',
      });
      setUserInput(userMessageText);
      setIsAiResponding(false);
      return;
    }

    try {
      const actionResult = await askReportOrchestratorAction(
        user.uid,
        analysisId,
        userMessageText,
        reportData.mdxContent, // Removed unused variable currentLanguageCode from parameters
        reportData.structuredReport,
        reportData.fileName,
        currentLanguageCode
      );

      if (actionResult.error) {
        // eslint-disable-next-line no-console
        console.error('Error from AI orchestrator action:', actionResult.error);
        toast({
          title: 'Erro na Resposta da IA',
          description: actionResult.error,
          variant: 'destructive',
        });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error('Failed to send message to orchestrator:', e);
      toast({
        title: 'Erro de Comunicação',
        description: `Não foi possível contatar o assistente: ${errorMsg}`,
        variant: 'destructive',
      });
      const aiErrorResponseForRtdb = {
        sender: 'ai' as const,
        text: `Desculpe, ocorreu um erro de comunicação: ${errorMsg}`,
        timestamp: serverTimestamp(),
        isError: true,
      };
      try {
        await push(chatRef, aiErrorResponseForRtdb);
      } catch (dbPushError) {
        // eslint-disable-next-line no-console
        console.error('Failed to push AI error message to RTDB:', dbPushError);
      }
    } finally {
      setIsAiResponding(false);
    }
  }, [userInput, isAiResponding, user, analysisId, reportData, toast]);

  return {
    chatMessages,
    userInput,
    isAiResponding,
    currentLanguageCode,
    handleSendMessage,
    setUserInput,
  };
}
