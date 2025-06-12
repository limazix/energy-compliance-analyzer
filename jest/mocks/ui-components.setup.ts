/**
 * @fileoverview Mocks for UI-related components and hooks for Jest.
 */
import React from 'react'; // Import React for createElement

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const icons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {};
  const handler = {
    get: (
      _target: object,
      prop: string | symbol
    ): React.FC<React.SVGProps<SVGSVGElement>> | boolean => {
      if (prop === '__esModule') return true;
      const MockLucideIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
        const { children, ...restProps } = props || {};
        return React.createElement(
          'svg',
          { 'data-lucide-mock': String(prop), ...restProps },
          children
        );
      };
      MockLucideIcon.displayName = `LucideMock(${String(prop)})`;
      return MockLucideIcon;
    },
  };
  return new Proxy(icons, handler);
});

// Mock useToast
export const mockToastFn = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToastFn,
  }),
}));

// Mock next-mdx-remote/rsc
jest.mock('next-mdx-remote/rsc', () => {
  const MDXRemoteComponent: React.FC<{ source: string | object }> = (props) => {
    let content = '';
    if (typeof props.source === 'string') {
      content = props.source;
    } else if (props.source && typeof props.source === 'object') {
      content = JSON.stringify(props.source);
    }
    return React.createElement('div', { 'data-testid': 'mock-mdx-remote' }, content);
  };
  MDXRemoteComponent.displayName = 'MockMDXRemote';
  return {
    MDXRemote: MDXRemoteComponent,
  };
});

// Mock remark plugins
jest.mock('remark-gfm', () => jest.fn());
jest.mock('remark-mermaidjs', () => jest.fn());
