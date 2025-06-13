import type { HTMLAttributes } from 'react';

import Image from 'next/image';

// Props atualizadas para refletir um elemento de imagem e permitir className
export function Logo(props: HTMLAttributes<HTMLImageElement>) {
  return (
    <Image
      src="https://placehold.co/200x60.png" // Placeholder with a common logo aspect ratio
      alt="EMA - Electric Magnitudes Analizer Logo"
      width={150} // Adjusted width for a wider logo
      height={45} // Adjusted height for a ~3.33:1 aspect ratio
      data-ai-hint="emu mascot safety helmet electrical graph modern" // Hint for AI image generation based on the new logo
      priority // Otimiza o carregamento do logo
      {...props} // Permite passar className e outros atributos HTML
    />
  );
}
