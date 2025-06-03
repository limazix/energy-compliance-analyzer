
'use client'; 

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { MDXRemote, type MDXRemoteProps } from 'next-mdx-remote/rsc'; 
import { getAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions';
import { askReportOrchestratorAction } from '@/features/report-chat/actions/reportChatActions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, AlertTriangle, Loader2, Send, UserCircle, Sparkles, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header'; 
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import type { AnalysisReportData, Analysis } from '@/types/analysis'; // Added Analysis
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { rtdb } from '@/lib/firebase'; // Import RTDB instance
import { ref, onValue, push, serverTimestamp, off } from 'firebase/database'; // Import RTDB functions
import type { AnalyzeComplianceReportOutput } from '@/ai/flows/analyze-compliance-report';


interface ReportDataState extends AnalysisReportData {
  isLoading: boolean;
  structuredReport: AnalyzeComplianceReportOutput | null; // Added for storing structured report
}

interface ChatMessage {
  id: string; // Will be the RTDB key
  sender: 'user' | 'ai';
  text: string;
  timestamp: number; // RTDB serverTimestamp will be a number
  // Optional fields if AI suggests report changes, to be stored with the AI's message
  revisedStructuredReport?: AnalyzeComplianceReportOutput;
  suggestedMdxChanges?: string;
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
  const [currentLanguageCode, setCurrentLanguageCode] = useState('pt-BR');

  const fetchReportData = useCallback(async (currentAnalysisId: string, currentUserId: string) => {
    setReportData(prev => ({ ...prev, isLoading: true, error: null, analysisId: currentAnalysisId }));
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
        toast({ title: "Erro ao Carregar Relatório", description: data.error, variant: "destructive"});
      } else {
        // Fetch structured report if MDX is loaded successfully
        // This assumes structuredReport is part of Analysis document, or a separate fetch is needed.
        // For now, we'll need to adjust getAnalysisReportAction or add another action.
        // Let's assume for now `getAnalysisReportAction` could also return structuredReport
        // For simplicity, let's just set it if available from a different source or in a later step.
        // For this PR, structuredReport will be populated when AI makes changes.
        setReportData({
          mdxContent: data.mdxContent || null,
          fileName: data.fileName || 'Relatório',
          analysisId: data.analysisId || currentAnalysisId,
          isLoading: false,
          error: null,
          structuredReport: null, // Initially null, will be updated by AI interactions
        });
         // Initial AI welcome message will be handled by RTDB listener if no messages exist
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
      toast({ title: "Erro ao Carregar", description: `Detalhes: ${errorMsg}`, variant: "destructive"});
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    setCurrentLanguageCode(navigator.language || 'pt-BR');

    if (user && user.uid && analysisId) {
      fetchReportData(analysisId, user.uid);

      const chatRef = ref(rtdb, `chats/${analysisId}`);
      const unsubscribe = onValue(chatRef, (snapshot) => {
        const data = snapshot.val();
        const loadedMessages: ChatMessage[] = [];
        if (data) {
          for (const key in data) {
            loadedMessages.push({ id: key, ...data[key] });
          }
          loadedMessages.sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp
        }
        
        if (loadedMessages.length === 0 && !reportData.isLoading && !reportData.error) {
           // Add initial AI welcome message if no messages exist and report is loaded
            const welcomeMessage: Omit<ChatMessage, 'id' | 'timestamp'> = {
                sender: 'ai',
                text: `Olá! Sou seu assistente para este relatório (${reportData.fileName || 'Relatório'}). Como posso ajudar você a entender ou refinar este documento?`,
            };
            push(chatRef, {...welcomeMessage, timestamp: serverTimestamp() });
        } else {
             setChatMessages(loadedMessages);
        }
      });
      return () => {
        off(chatRef); // Detach listener
        unsubscribe();
      };
    } else if (!analysisId && user && !authLoading) {
        setReportData({
            mdxContent: null, fileName: null, analysisId: null, isLoading: false,
            error: "ID da análise não encontrado na URL.", structuredReport: null,
        });
    }
  }, [analysisId, user, authLoading, router, fetchReportData, reportData.isLoading, reportData.error, reportData.fileName]); // Added reportData dependencies

  useEffect(() => {
    // Scroll to bottom of chat
    if (chatScrollAreaRef.current) {
      const scrollElement = chatScrollAreaRef.current.children[0] as HTMLDivElement;
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [chatMessages]);


  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || isAiResponding || !user || !reportData.fileName) {
      if (!userInput.trim()) {
        toast({ title: "Entrada vazia", description: "Por favor, digite sua pergunta.", variant: "destructive"});
      }
      return;
    }
    if (!reportData.mdxContent && !reportData.structuredReport) {
        toast({ title: "Relatório não carregado", description: "O conteúdo do relatório não está disponível para interação.", variant: "destructive"});
        return;
    }

    const userMessageText = userInput.trim();
    setUserInput(''); // Clear input immediately

    const chatRef = ref(rtdb, `chats/${analysisId}`);
    const userMessageForRtdb: Omit<ChatMessage, 'id' | 'timestamp'> = {
      sender: 'user',
      text: userMessageText,
    };
    try {
      await push(chatRef, {...userMessageForRtdb, timestamp: serverTimestamp()});
    } catch (dbError) {
      console.error("Failed to push user message to RTDB:", dbError);
      toast({ title: "Erro ao Enviar", description: "Não foi possível enviar sua mensagem.", variant: "destructive"});
      setUserInput(userMessageText); // Restore input if send failed
      return;
    }
    
    setIsAiResponding(true);

    try {
      // Use current mdxContent and structuredReport from state for the orchestrator
      const currentMdx = reportData.mdxContent;
      const currentStructReport = reportData.structuredReport;

      if (!currentMdx) {
         throw new Error("Conteúdo MDX do relatório não está disponível para o orquestrador.");
      }
      if (!currentStructReport) { // Assuming orchestrator always needs structured report for revisions
         // Potentially fetch it here if it's not loaded but MDX is.
         // For now, let's assume it should ideally be available if MDX is.
         // If it's critical for all interactions, this needs a robust way to ensure it's loaded.
         console.warn("[handleSendMessage] Structured report is null. Revisor tool might not work optimally.");
      }

      const result = await askReportOrchestratorAction(
        user.uid,
        analysisId,
        userMessageText,
        currentMdx,
        currentStructReport, // Pass current structured report
        reportData.fileName,
        currentLanguageCode
      );

      let aiTextResponse = "Desculpe, não consegui processar sua solicitação no momento.";
      let aiMessageForRtdb: Omit<ChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: aiTextResponse };

      if (result.error) {
        console.error("Error from AI orchestrator action:", result.error);
        toast({ title: "Erro na Resposta da IA", description: result.error, variant: "destructive" });
        aiMessageForRtdb.text = `Ocorreu um erro: ${result.error}`;
      } else {
        aiMessageForRtdb.text = result.aiResponseText || aiTextResponse;
        if (result.revisedStructuredReport && result.suggestedMdxChanges) {
          aiMessageForRtdb.revisedStructuredReport = result.revisedStructuredReport;
          aiMessageForRtdb.suggestedMdxChanges = result.suggestedMdxChanges;
          // Update local state for MDX rendering immediately
          setReportData(prev => ({
            ...prev,
            mdxContent: result.suggestedMdxChanges || prev.mdxContent,
            structuredReport: result.revisedStructuredReport || prev.structuredReport,
          }));
          toast({ title: "Relatório Atualizado", description: "O relatório foi modificado pela IA."});
        }
      }
      await push(chatRef, {...aiMessageForRtdb, timestamp: serverTimestamp()});

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to send message to orchestrator:", e);
      toast({ title: "Erro de Comunicação", description: `Não foi possível contatar o assistente: ${errorMsg}`, variant: "destructive" });
      const aiErrorResponseForRtdb: Omit<ChatMessage, 'id' | 'timestamp'> = {
        sender: 'ai',
        text: `Desculpe, ocorreu um erro de comunicação: ${errorMsg}`,
      };
      try {
        await push(chatRef, {...aiErrorResponseForRtdb, timestamp: serverTimestamp()});
      } catch (dbPushError) {
        console.error("Failed to push AI error message to RTDB:", dbPushError);
      }
    } finally {
      setIsAiResponding(false);
    }
  }, [userInput, isAiResponding, user, analysisId, reportData.mdxContent, reportData.fileName, reportData.structuredReport, currentLanguageCode, toast]);

  const handleRetryFetch = () => {
    if (user && user.uid && analysisId) {
      fetchReportData(analysisId, user.uid);
    }
  };


  if (authLoading || reportData.isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
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
              <AlertTriangle className="mr-2 h-7 w-7"/> Falha ao Carregar Relatório
            </h1>
             {reportData.fileName && <p className="text-sm text-muted-foreground mt-1">Arquivo: {reportData.fileName}</p>}
            <p className="text-destructive-foreground mt-2">{reportData.error}</p>
            <div className="mt-6 space-x-2">
                <Button onClick={handleRetryFetch}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
                </Button>
                <Button asChild variant="outline">
                  <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
                </Button>
            </div>
          </div>
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
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
            <p className="text-muted-foreground mt-2">O conteúdo do relatório para a análise com ID: {reportData.analysisId || 'desconhecido'} não pôde ser carregado ou não existe.</p>
             {reportData.fileName && <p className="text-sm text-muted-foreground mt-1">Arquivo: {reportData.fileName}</p>}
            <div className="mt-6 space-x-2">
                 <Button onClick={handleRetryFetch}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Tentar Novamente
                </Button>
                <Button asChild variant="outline">
                  <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
                </Button>
            </div>
          </div>
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
         </footer>
      </div>
    );
  }

  const mdxProps: MDXRemoteProps = {
    source: reportData.mdxContent,
    // components: { /* Custom components if any */ }
  };

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
            <h1 className="text-3xl font-bold text-primary">{reportData.fileName ? `Relatório: ${reportData.fileName}` : 'Relatório Detalhado'}</h1>
            <p className="text-sm text-muted-foreground">Análise ID: {reportData.analysisId}</p>
        </div>

        <article className="prose prose-slate lg:prose-xl max-w-none bg-card p-6 sm:p-8 md:p-10 rounded-lg shadow-lg">
          <Suspense fallback={<div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/> Carregando relatório...</div>}>
            {/* @ts-expect-error MDXRemoteProps might be expecting compiledSource from serialize, but we're passing raw string */}
            <MDXRemote {...mdxProps} />
          </Suspense>
        </article>

        <section className="mt-12 p-6 bg-card rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-primary flex items-center">
            <Sparkles className="mr-3 h-7 w-7 text-accent" /> Interagir com o Relatório
          </h2>
          
          <ScrollArea className="h-80 w-full rounded-md border p-4 mb-4 bg-background/50" ref={chatScrollAreaRef}>
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "mb-3 flex items-start gap-3 p-3 rounded-lg max-w-[85%]",
                  msg.sender === 'user' 
                    ? "ml-auto bg-primary/80 text-primary-foreground flex-row-reverse shadow-md" 
                    : "mr-auto bg-muted text-foreground shadow"
                )}
              >
                <Avatar className="h-8 w-8 border border-border/50">
                  <AvatarImage src={msg.sender === 'user' ? user?.photoURL ?? undefined : undefined} />
                  <AvatarFallback className={cn(msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground')}>
                    {msg.sender === 'user' ? (user?.displayName?.charAt(0)?.toUpperCase() || <UserCircle/>) : <Sparkles/>}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("flex flex-col", msg.sender === 'user' ? 'items-end' : 'items-start')}>
                  <p className={cn("text-sm whitespace-pre-wrap", msg.sender === 'user' ? 'text-right' : 'text-left')}>{msg.text}</p>
                  <span className="text-xs text-muted-foreground/80 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {isAiResponding && (
              <div className="mb-3 flex items-start gap-3 p-3 rounded-lg max-w-[85%] mr-auto bg-muted text-foreground">
                 <Avatar className="h-8 w-8 border border-border/50">
                   <AvatarFallback className='bg-accent text-accent-foreground'><Sparkles/></AvatarFallback>
                 </Avatar>
                 <div className="pt-1">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                 </div>
              </div>
            )}
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
              disabled={isAiResponding || reportData.isLoading}
              aria-label="Caixa de texto para interagir com o relatório"
            />
            <Button onClick={handleSendMessage} disabled={!userInput.trim() || isAiResponding || reportData.isLoading} size="lg" className="shadow-md">
              <Send className="mr-0 sm:mr-2 h-5 w-5" />
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </div>
           <p className="text-xs text-muted-foreground mt-2">
            Dica: Pressione Shift+Enter para nova linha. Use o idioma '{currentLanguageCode}' para interagir.
          </p>
        </section>
      </main>
       <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
        © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
       </footer>
    </div>
  );
}

