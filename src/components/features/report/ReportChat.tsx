/**
 * @fileoverview
 * This module defines the `ReportChat` component, which provides an
 * interactive chat interface for users to ask questions about the report.
 */

import { Sparkles, Send, UserCircle } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { User } from 'firebase/auth';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
  isError?: boolean;
}

interface ReportChatProps {
  chatMessages: ChatMessage[];
  userInput: string;
  onUserInput: (input: string) => void;
  onSendMessage: () => void;
  isAiResponding: boolean;
  user: User | null;
  currentLanguageCode: string;
  isReportReady: boolean;
  chatScrollAreaRef: React.RefObject<HTMLDivElement>;
}

/**
 * A component that provides an interactive chat interface for the report page.
 * @param {ReportChatProps} props The props for the component.
 * @returns {JSX.Element} The rendered chat component.
 */
export function ReportChat({
  chatMessages,
  userInput,
  onUserInput,
  onSendMessage,
  isAiResponding,
  user,
  currentLanguageCode,
  isReportReady,
  chatScrollAreaRef,
}: ReportChatProps) {
  return (
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
              className={cn('flex flex-col', msg.sender === 'user' ? 'items-end' : 'items-start')}
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
          onChange={(e) => onUserInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
          disabled={isAiResponding || !isReportReady}
          aria-label="Caixa de texto para interagir com o relatório"
        />
        <Button
          onClick={onSendMessage}
          disabled={!userInput.trim() || isAiResponding || !isReportReady}
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
        {!isReportReady &&
          ' O chat interativo requer que o relatório estruturado esteja carregado.'}
      </p>
    </section>
  );
}
