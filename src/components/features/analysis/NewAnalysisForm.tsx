
'use client';

import { Loader2, UploadCloud, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress'; // Para mostrar progresso do upload
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Para mostrar erros

type NewAnalysisFormProps = {
  fileToUpload: File | null;
  isUploading: boolean;
  uploadProgress: number; // Progresso específico do upload do arquivo (0-100)
  uploadError: string | null; // Mensagem de erro do upload
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadAndAnalyze: () => void;
  onCancel: () => void;
};

export function NewAnalysisForm({
  fileToUpload,
  isUploading,
  uploadProgress,
  uploadError,
  onFileChange,
  onUploadAndAnalyze,
  onCancel,
}: NewAnalysisFormProps) {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-primary">Nova Análise de Conformidade</CardTitle>
        <CardDescription>Faça upload do seu arquivo CSV de dados de qualidade de energia.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input 
          type="file" 
          accept=".csv" 
          onChange={onFileChange} 
          className="text-base p-2 border-2 border-dashed h-auto" 
          disabled={isUploading}
        />
        
        {fileToUpload && !isUploading && <p className="text-sm text-muted-foreground">Arquivo selecionado: {fileToUpload.name}</p>}
        
        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full h-4" />
            <p className="text-sm text-primary text-center">Enviando arquivo: {Math.round(uploadProgress)}%</p>
          </div>
        )}

        {uploadError && !isUploading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro no Upload</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4 pt-2">
          <Button 
            onClick={onUploadAndAnalyze} 
            disabled={!fileToUpload || isUploading} 
            className="w-full md:w-auto" 
            size="lg"
          >
            {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
            {isUploading ? 'Enviando...' : 'Enviar e Iniciar Análise'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onCancel} 
            className="w-full md:w-auto" 
            size="lg"
            disabled={isUploading}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
