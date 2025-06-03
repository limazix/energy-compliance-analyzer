
'use client'; 

import { Suspense, useEffect, useState, useCallback } from 'react';
import { MDXRemote, type MDXRemoteProps } from 'next-mdx-remote/rsc'; 
import { getAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions';
import { askReportOrchestratorAction } from '@/features/report-chat/actions/reportChatActions'; // New Action
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, AlertTriangle, Loader2, Send, UserCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header'; 
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import type { AnalysisReportData } from '@/types/analysis';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface ReportDataState extends AnalysisReportData {
  isLoading: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const analysisId = params.analysisId as string; 
  const { toast } = useToast(); // Initialize toast

  const { user, loading: authLoading } = useAuth();

  const [reportData, setReportData] = useState<ReportDataState>({
    mdxContent: null,
    fileName: null,
    analysisId: analysisId,
    isLoading: true,
    error: null,
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [currentLanguageCode, setCurrentLanguageCode] = useState('pt-BR'); // Default language

  useEffect(() => {
    if (authLoading) {
      return; 
    }

    if (!user) {
      router.replace('/login'); 
      return;
    }
    // Set language code from browser or default
    setCurrentLanguageCode(navigator.language || 'pt-BR');

    if (user && user.uid && analysisId) {
      setReportData(prev => ({ ...prev, isLoading: true, error: null, analysisId: analysisId }));
      getAnalysisReportAction(user.uid, analysisId)
        .then(data => {
          if (data.error) {
            setReportData({
              mdxContent: null,
              fileName: data.fileName, 
              analysisId: data.analysisId || analysisId,
              isLoading: false,
              error: data.error,
            });
          } else {
            setReportData({
              mdxContent: data.mdxContent || null,
              fileName: data.fileName || 'Relatório',
              analysisId: data.analysisId || analysisId,
              isLoading: false,
              error: null,
            });
            setChatMessages([
              {
                id: 'ai-welcome',
                sender: 'ai',
                text: `Olá! Sou seu assistente para este relatório (${data.fileName || 'Relatório'}). Como posso ajudar você a entender ou refinar este documento? Você pode pedir esclarecimentos, solicitar mais detalhes sobre seções específicas ou até mesmo pedir alterações.`,
                timestamp: new Date(),
              }
            ]);
          }
        })
        .catch(e => {
          const errorMsg = e instanceof Error ? e.message : String(e);
          setReportData({
            mdxContent: null,
            fileName: null,
            analysisId: analysisId,
            isLoading: false,
            error: `Erro ao carregar o relatório: ${errorMsg}`,
          });
          toast({ title: "Erro ao Carregar", description: `Detalhes: ${errorMsg}`, variant: "destructive"});
        });
    } else if (!analysisId && user && !authLoading) { 
        setReportData({
            mdxContent: null,
            fileName: null,
            analysisId: null,
            isLoading: false,
            error: "ID da análise não encontrado na URL.",
        });
    }
  }, [analysisId, user, authLoading, router, toast]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || isAiResponding || !user || !reportData.mdxContent || !reportData.fileName) {
      if (!userInput.trim()) {
        toast({ title: "Entrada vazia", description: "Por favor, digite sua pergunta.", variant: "destructive"});
      }
      return;
    }

    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, newUserMessage]);
    const currentInput = userInput.trim();
    setUserInput('');
    setIsAiResponding(true);

    try {
      const result = await askReportOrchestratorAction(
        user.uid,
        analysisId,
        currentInput,
        reportData.mdxContent,
        reportData.fileName,
        currentLanguageCode
      );

      let aiTextResponse = "Desculpe, não consegui processar sua solicitação no momento.";
      if (result.error) {
        console.error("Error from AI orchestrator action:", result.error);
        toast({ title: "Erro na Resposta da IA", description: result.error, variant: "destructive" });
        aiTextResponse = `Ocorreu um erro: ${result.error}`;
      } else if (result.aiResponseText) {
        aiTextResponse = result.aiResponseText;
      }

      const aiResponse: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiTextResponse,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiResponse]);

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to send message to orchestrator:", e);
      toast({ title: "Erro de Comunicação", description: `Não foi possível contatar o assistente: ${errorMsg}`, variant: "destructive" });
       const aiErrorResponse: ChatMessage = {
        id: `ai-error-${Date.now()}`,
        sender: 'ai',
        text: `Desculpe, ocorreu um erro de comunicação ao tentar processar sua solicitação: ${errorMsg}`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiErrorResponse]);
    } finally {
      setIsAiResponding(false);
    }
  }, [userInput, isAiResponding, user, analysisId, reportData.mdxContent, reportData.fileName, currentLanguageCode, toast]);


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
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
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
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
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
          
          <ScrollArea className="h-80 w-full rounded-md border p-4 mb-4 bg-background/50">
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
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              disabled={isAiResponding}
              aria-label="Caixa de texto para interagir com o relatório"
            />
            <Button onClick={handleSendMessage} disabled={!userInput.trim() || isAiResponding} size="lg" className="shadow-md">
              <Send className="mr-0 sm:mr-2 h-5 w-5" />
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </div>
           <p className="text-xs text-muted-foreground mt-2">
            Dica: Pressione Shift+Enter para nova linha.
          </p>
        </section>
      </main>
       <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
        © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
       </footer>
    </div>
  );
}
