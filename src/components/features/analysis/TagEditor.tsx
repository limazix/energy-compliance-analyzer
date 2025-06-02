
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TagEditorProps = {
  analysisId: string;
  tags: string[];
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: (analysisId: string, tag: string) => void;
  onRemoveTag: (analysisId: string, tag: string) => void;
};

export function TagEditor({
  analysisId,
  tags,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}: TagEditorProps) {
  return (
    <div className="mt-6 space-y-2">
      <h4 className="text-md font-semibold">Tags:</h4>
      <div className="flex flex-wrap gap-2 mb-2">
        {(tags || []).map(tag => (
          <Badge key={tag} variant="secondary" className="text-sm py-1 px-3">
            {tag}
            <button onClick={() => onRemoveTag(analysisId, tag)} className="ml-2 text-muted-foreground hover:text-destructive">&times;</button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          placeholder="Adicionar tag"
          className="max-w-xs"
          onKeyDown={(e) => e.key === 'Enter' && onAddTag(analysisId, tagInput)}
        />
        <Button onClick={() => onAddTag(analysisId, tagInput)} variant="outline" size="sm">Adicionar</Button>
      </div>
    </div>
  );
}

    
