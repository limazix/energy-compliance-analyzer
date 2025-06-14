'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import {
  type Unsubscribe as RTDBUnsubscribe,
  off,
  onValue,
  push,
  ref,
  serverTimestamp,
} from 'firebase/database';
import {
  type Unsubscribe as FirestoreUnsubscribe,
  doc,
  getDoc,
  onSnapshot as firestoreOnSnapshot,
} from 'firebase/firestore'; // Added for structuredReport listener
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import remarkMermaid from 'remark-mermaidjs';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { AppHeader } from '@/components/app-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { APP_CONFIG } from '@/config/appConfig';
import { useAuth } from '@/contexts/auth-context';
import { askReportOrchestratorAction } from '@/features/report-chat/actions/reportChatActions';
import { getAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions';
import { useToast } from '@/hooks/use-toast';
import { db, rtdb } from '@/lib/firebase'; // Added db for structuredReport listener
import { cn } from '@/lib/utils';
import type { Analysis } from '@/types/analysis';

interface ReportDataState {
  mdxContent: string | null;
  fileName: string | null;
  analysisId: string | null; // Ensure this is always a string if report page is loaded
  isLoading: boolean;
  error: string | null;
  structuredReport: AnalyzeComplianceReportOutput | null;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
  isError?: boolean; // Custom flag for AI error messages in chat
}

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const analysisId = params.analysisId as string;
  const { toast } = useToast();

  const { user, loading: authLoading } = useAuth();
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  const [reportData, setReportData] = useState<ReportDataState>({
    mdxContent: null,
    fileName: null,
    analysisId: analysisId,
    isLoading: true,
    error: null,
    structuredReport: null,
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [currentLanguageCode, setCurrentLanguageCode] = useState(APP_CONFIG.DEFAULT_LANGUAGE_CODE);

  const fetchReportAndInitialStructuredData = useCallback(
    async (currentAnalysisId: string, currentUserId: string) => {
      setReportData((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        analysisId: currentAnalysisId,
      }));
      try {
        const data = await getAnalysisReportAction(currentUserId, currentAnalysisId);
        if (data.error) {
          setReportData({
            mdxContent: null,
            fileName: data.fileName,
            analysisId: data.analysisId || currentAnalysisId,
            isLoading: false,
            error: data.error,
            structuredReport: null,
          });
          toast({
            title: 'Erro ao Carregar Relatório',
            description: data.error,
            variant: 'destructive',
          });
        } else {
          const analysisDocRef = doc(db, 'users', currentUserId, 'analyses', currentAnalysisId);
          const analysisSnap = await getDoc(analysisDocRef);
          let initialStructuredReport: AnalyzeComplianceReportOutput | null = null;
          if (analysisSnap.exists()) {
            initialStructuredReport = (analysisSnap.data() as Analysis).structuredReport || null;
          }

          setReportData({
            mdxContent: data.mdxContent || null,
            fileName: data.fileName || 'Relatório',
            analysisId: data.analysisId || currentAnalysisId,
            isLoading: false,
            error: null,
            structuredReport: initialStructuredReport,
          });
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setReportData({
          mdxContent: null,
          fileName: null,
          analysisId: currentAnalysisId,
          isLoading: false,
          error: `Erro ao carregar o relatório: ${errorMsg}`,
          structuredReport: null,
        });
        toast({
          title: 'Erro ao Carregar',
          description: `Detalhes: ${errorMsg}`,
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!user?.uid || !analysisId || reportData.isLoading) return;

    const analysisDocRef = doc(db, 'users', user.uid, 'analyses', analysisId);
    const unsubscribeFirestore: FirestoreUnsubscribe = firestoreOnSnapshot(
      analysisDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const analysisData = docSnap.data() as Analysis;
          const newStructuredReport = analysisData.structuredReport || null;
          const newMdxPath = analysisData.mdxReportStoragePath;

          const hasStructuredReportChanged =
            JSON.stringify(newStructuredReport) !== JSON.stringify(reportData.structuredReport);

          if (hasStructuredReportChanged) {
            // eslint-disable-next-line no-console
            console.debug(
              '[ReportPage] Firestore listener: structuredReport or mdxReportStoragePath changed. Updating state.'
            );
            setReportData((prev) => ({
              ...prev,
              structuredReport: newStructuredReport,
            }));
            if (newMdxPath && user.uid && analysisId) {
              try {
                const updatedMdxData = await getAnalysisReportAction(user.uid, analysisId);
                if (!updatedMdxData.error && updatedMdxData.mdxContent) {
                  setReportData((prev) => ({
                    ...prev,
                    mdxContent: updatedMdxData.mdxContent,
                    fileName: updatedMdxData.fileName || prev.fileName,
                  }));
                  toast({
                    title: 'Relatório Atualizado',
                    description: 'O conteúdo do relatório foi atualizado remotamente.',
                  });
                }
              } catch (fetchError) {
                // eslint-disable-next-line no-console
                console.error(
                  '[ReportPage] Error re-fetching MDX after Firestore update:',
                  fetchError
                );
              }
            }
          }
        }
      }
    );
    return () => unsubscribeFirestore();
  }, [user, analysisId, reportData.isLoading, reportData.structuredReport, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    setCurrentLanguageCode(navigator.language || APP_CONFIG.DEFAULT_LANGUAGE_CODE);

    let unsubscribeRTDB: RTDBUnsubscribe | undefined;

    if (user && user.uid && analysisId) {
      if (reportData.isLoading && !reportData.error) {
        fetchReportAndInitialStructuredData(analysisId, user.uid);
      }

      const chatRef = ref(rtdb, `chats/${analysisId}`);
      unsubscribeRTDB = onValue(chatRef, (snapshot) => {
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
    } else if (!analysisId && user && !authLoading) {
      setReportData({
        mdxContent: null,
        fileName: null,
        analysisId: null,
        isLoading: false,
        error: 'ID da análise não encontrado na URL.',
        structuredReport: null,
      });
    }
    return () => {
      if (unsubscribeRTDB) {
        off(ref(rtdb, `chats/${analysisId}`)); // Detach the specific listener
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    analysisId,
    user,
    authLoading,
    router,
    fetchReportAndInitialStructuredData,
    // reportData.isLoading, reportData.error, reportData.fileName were removed to prevent infinite loop if they change due to fetchReport
  ]);

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      const scrollElement = chatScrollAreaRef.current.querySelector(
        'div[data-radix-scroll-area-viewport]'
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [chatMessages]);

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
        reportData.mdxContent,
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

      if (
        actionResult.reportModified &&
        actionResult.revisedStructuredReport &&
        actionResult.newMdxContent
      ) {
        setReportData((prev) => ({
          ...prev,
          structuredReport: actionResult.revisedStructuredReport!,
          mdxContent: actionResult.newMdxContent!,
        }));
        toast({
          title: 'Relatório Atualizado',
          description: 'O relatório foi modificado pela IA.',
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
  }, [userInput, isAiResponding, user, analysisId, reportData, currentLanguageCode, toast]);

  const handleRetryFetch = () => {
    if (user && user.uid && analysisId) {
      fetchReportAndInitialStructuredData(analysisId, user.uid);
    }
  };

  if (authLoading || (reportData.isLoading && !reportData.error)) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader />
        <main
          className="container mx-auto py-8 px-4 flex-1 flex items-center justify-center"
          aria-busy="true"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
        <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
          © {new Date().getFullYear()} EMA - Electric Magnitudes Analyzer. Todos os direitos
          reservados.
          <div className="mt-1">
            <Link href="/privacy-policy" className="hover:underline">
              Política de Privacidade
            </Link>
            {' | '}
            <Link href="/terms-of-service" className="hover:underline">
              Termos de Serviço
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  if (reportData.error) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10 bg-destructive/10 border border-destructive rounded-md p-6">
            <h1 className="text-2xl font-bold text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-7 w-7" /> Falha ao Carregar Relatório
            </h1>
            {reportData.fileName && (
              <p className="text-sm text-muted-foreground mt-1">Arquivo: {reportData.fileName}</p>
            )}
            <p className="text-destructive-foreground mt-2">{reportData.error}</p>
            <div className="mt-6 space-x-2">
              <Button onClick={handleRetryFetch}>
                <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
              </Button>
              <Button asChild variant="outline">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial
                </Link>
              </Button>
            </div>
          </div>
        </main>
        <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
          © {new Date().getFullYear()} EMA - Electric Magnitudes Analyzer. Todos os direitos
          reservados.
          <div className="mt-1">
            <Link href="/privacy-policy" className="hover:underline">
              Política de Privacidade
            </Link>
            {' | '}
            <Link href="/terms-of-service" className="hover:underline">
              Termos de Serviço
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  if (!reportData.mdxContent) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10">
            <h1 className="text-2xl font-bold text-destructive">Relatório Não Encontrado</h1>
            <p className="text-muted-foreground mt-2">
              O conteúdo do relatório para a análise com ID:{' '}
              {reportData.analysisId || 'desconhecido'} não pôde ser carregado ou não existe.
            </p>
            {reportData.fileName && (
              <p className="text-sm text-muted-foreground mt-1">Arquivo: {reportData.fileName}</p>
            )}
            <div className="mt-6 space-x-2">
              <Button onClick={handleRetryFetch}>
                <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
              </Button>
              <Button asChild variant="outline">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial
                </Link>
              </Button>
            </div>
          </div>
        </main>
        <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
          © {new Date().getFullYear()} EMA - Electric Magnitudes Analyzer. Todos os direitos
          reservados.
          <div className="mt-1">
            <Link href="/privacy-policy" className="hover:underline">
              Política de Privacidade
            </Link>
            {' | '}
            <Link href="/terms-of-service" className="hover:underline">
              Termos de Serviço
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  const mdxSource =
    reportData.mdxContent || '# Relatório indisponível\nO conteúdo não pôde ser carregado.';

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <AppHeader />
      <main className="container mx-auto py-8 px-4 flex-1">
        <div className="mb-6 flex justify-between items-center">
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Análises
            </Link>
          </Button>
        </div>

        <div className="mb-4 p-4 bg-card rounded-lg shadow">
          <h1 className="text-3xl font-bold text-primary">
            {reportData.fileName ? `Relatório: ${reportData.fileName}` : 'Relatório Detalhado'}
          </h1>
          <p className="text-sm text-muted-foreground">Análise ID: {reportData.analysisId}</p>
        </div>

        <article className="prose prose-slate lg:prose-xl max-w-none bg-card p-6 sm:p-8 md:p-10 rounded-lg shadow-lg">
          <Suspense
            fallback={
              <div className="text-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /> Carregando
                relatório...
              </div>
            }
          >
            <MDXRemote
              source={mdxSource}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm, remarkMermaid],
                },
              }}
              // components={{ /* Custom components if any */ }}
            />
          </Suspense>
        </article>

        <section className="mt-12 p-6 bg-card rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-primary flex items-center">
            <Sparkles className="mr-3 h-7 w-7 text-accent" /> Interagir com o Relatório
          </h2>

          <ScrollArea
            className="h-80 w-full rounded-md border p-4 mb-4 bg-background/50"
            ref={chatScrollAreaRef}
          >
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'mb-3 flex items-start gap-3 p-3 rounded-lg max-w-[85%]',
                  msg.sender === 'user'
                    ? 'ml-auto bg-primary/80 text-primary-foreground flex-row-reverse shadow-md'
                    : 'mr-auto bg-muted text-foreground shadow',
                  msg.isError && msg.sender === 'ai'
                    ? 'bg-destructive/20 border border-destructive/50'
                    : ''
                )}
              >
                <Avatar className="h-8 w-8 border border-border/50">
                  <AvatarImage
                    src={msg.sender === 'user' ? (user?.photoURL ?? undefined) : undefined}
                    alt={msg.sender === 'user' ? (user?.displayName ?? 'Usuário') : 'Assistente IA'}
                  />
                  <AvatarFallback
                    className={cn(
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent text-accent-foreground',
                      msg.isError && msg.sender === 'ai'
                        ? 'bg-destructive text-destructive-foreground'
                        : ''
                    )}
                  >
                    {msg.sender === 'user' ? (
                      user?.displayName?.charAt(0)?.toUpperCase() || <UserCircle />
                    ) : (
                      <Sparkles />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'flex flex-col',
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm whitespace-pre-wrap',
                      msg.sender === 'user' ? 'text-right' : 'text-left'
                    )}
                  >
                    {msg.text || (msg.sender === 'ai' && !msg.isError ? '...' : '')}
                  </p>
                  <span className="text-xs text-muted-foreground/80 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </ScrollArea>

          <div className="flex items-start gap-2">
            <Textarea
              placeholder="Pergunte sobre o relatório, peça esclarecimentos ou solicite alterações..."
              className="flex-1 min-h-[60px] resize-none shadow-sm focus:ring-2 focus:ring-primary"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isAiResponding || reportData.isLoading || !reportData.structuredReport}
              aria-label="Caixa de texto para interagir com o relatório"
            />
            <Button
              onClick={handleSendMessage}
              disabled={
                !userInput.trim() ||
                isAiResponding ||
                reportData.isLoading ||
                !reportData.structuredReport
              }
              size="lg"
              className="shadow-md"
            >
              <Send className="mr-0 sm:mr-2 h-5 w-5" />
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Dica: Pressione Shift+Enter para nova linha. Use o idioma &lsquo;{currentLanguageCode}
            &rsquo; para interagir.
            {!reportData.structuredReport &&
              !reportData.isLoading &&
              ' O chat interativo requer que o relatório estruturado esteja carregado.'}
          </p>
        </section>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
        © {new Date().getFullYear()} EMA - Electric Magnitudes Analyzer. Todos os direitos
        reservados.
        <div className="mt-1">
          <Link href="/privacy-policy" className="hover:underline">
            Política de Privacidade
          </Link>
          {' | '}
          <Link href="/terms-of-service" className="hover:underline">
            Termos de Serviço
          </Link>
        </div>
      </footer>
    </div>
  );
}
