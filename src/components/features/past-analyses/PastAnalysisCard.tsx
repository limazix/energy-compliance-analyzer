
'use client';

import type { Analysis } from '@/types/analysis';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileCheck2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type PastAnalysisCardProps = {
  analysis: Analysis;
  onViewDetails: (analysis: Analysis) => void;
  onDeleteAnalysis: (analysisId: string) => void;
};

const getStatusBadgeVariant = (status: Analysis['status']) => {
  switch (status) {
    case 'completed': return 'default'; // Will be styled with bg-green-500
    case 'error': return 'destructive';
    default: return 'secondary';
  }
};

const getStatusLabel = (status: Analysis['status']) => {
  switch (status) {
    case 'uploading': return 'Enviando';
    case 'identifying_regulations': return 'Identificando Resoluções';
    case 'assessing_compliance': return 'Analisando Conformidade';
    case 'completed': return 'Concluída';
    case 'error': return 'Erro';
    case 'deleted': return 'Excluída';
    default: return status;
  }
};

export function PastAnalysisCard({ analysis, onViewDetails, onDeleteAnalysis }: PastAnalysisCardProps) {
  return (
    <li className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-card">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-primary-foreground">{analysis.fileName}</h3>
          <p className="text-sm text-muted-foreground">
            Criada em: {analysis.createdAt ? format(new Date(analysis.createdAt as string), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Data indisponível'}
          </p>
          <div className="text-sm text-muted-foreground">
            Status: <Badge 
              variant={getStatusBadgeVariant(analysis.status)} 
              className={analysis.status === 'completed' ? 'bg-green-500 text-white' : ''}
            >
              {getStatusLabel(analysis.status)}
            </Badge>
          </div>
          {analysis.tags && analysis.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {analysis.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewDetails(analysis)}>
            <FileCheck2 className="mr-1 h-4 w-4" /> Ver Detalhes
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">Excluir</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir a análise do arquivo "{analysis.fileName}"? Esta ação marcará a análise como excluída.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDeleteAnalysis(analysis.id)}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </li>
  );
}

    
