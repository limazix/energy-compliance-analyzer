import type { HTMLAttributes } from 'react';

import Image from 'next/image';

// Props atualizadas para refletir um elemento de imagem e permitir className
export function Logo(props: HTMLAttributes<HTMLImageElement>) {
  return (
    <Image
      src="https://placehold.co/200x150.png" // Placeholder with a more illustrative aspect ratio
      alt="EMA - Electric Magnitudes Analizer Logo"
      width={120} // Adjusted width
      height={90} // Adjusted height for a 4:3 aspect ratio
      data-ai-hint="stylized emu safety gear clipboard electrical" // Hint for AI image generation
      priority // Otimiza o carregamento do logo
      {...props} // Permite passar className e outros atributos HTML
    />
  );
}
