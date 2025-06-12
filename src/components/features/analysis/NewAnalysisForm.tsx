'use client';
import { useEffect, useState } from 'react';

import { AlertCircle, Loader2, UploadCloud } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

type NewAnalysisFormProps = {
  fileToUpload: File | null;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadAndAnalyze: (title: string, description: string) => void; // Modified to pass title and description
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (fileToUpload) {
      setTitle(fileToUpload.name); // Default title to filename
      setDescription(''); // Reset description
    } else {
      setTitle('');
      setDescription('');
    }
  }, [fileToUpload]);

  const handleSubmit = () => {
    if (fileToUpload) {
      onUploadAndAnalyze(title || fileToUpload.name, description);
    }
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-primary">
          Nova Análise de Conformidade
        </CardTitle>
        <CardDescription>
          Faça upload do seu arquivo CSV e adicione um título e descrição para a análise.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="analysis-file" className="mb-2 block text-sm font-medium text-foreground">
            Arquivo CSV de Dados
          </Label>
          <Input
            id="analysis-file"
            type="file"
            accept=".csv"
            onChange={onFileChange}
            className="text-base p-2 border-2 border-dashed h-auto"
            disabled={isUploading}
          />
          {fileToUpload && !isUploading && (
            <p className="mt-1 text-sm text-muted-foreground">
              Arquivo selecionado: {fileToUpload.name}
            </p>
          )}
        </div>

        <div>
          <Label
            htmlFor="analysis-title"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Título da Análise
          </Label>
          <Input
            id="analysis-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Análise Trimestral Setor X"
            disabled={isUploading || !fileToUpload}
            className="text-base"
          />
        </div>

        <div>
          <Label
            htmlFor="analysis-description"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Descrição (Opcional)
          </Label>
          <Textarea
            id="analysis-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Verificação de conformidade dos dados de energia do transformador T01 do período Y."
            disabled={isUploading || !fileToUpload}
            className="text-base min-h-[80px]"
          />
        </div>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full h-4" />
            <p className="text-sm text-primary text-center">
              Enviando arquivo: {Math.round(uploadProgress)}%
            </p>
          </div>
        )}

        {uploadError && !isUploading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro no Upload</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!fileToUpload || isUploading}
            className="w-full sm:w-auto flex-grow"
            size="lg"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-5 w-5" />
            )}
            {isUploading ? 'Enviando...' : 'Enviar e Iniciar Análise'}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
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
