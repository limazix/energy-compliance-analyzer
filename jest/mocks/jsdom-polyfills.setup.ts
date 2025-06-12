/**
 * @fileoverview JSDOM API Mocks and Polyfills for Jest.
 */

// JSDOM API Mocks
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

window.matchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback): number => {
  if (typeof cb === 'function') cb(0);
  return 0;
});
global.cancelAnimationFrame = jest.fn();

if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 0;
      this.width = params.width || 1;
      this.height = params.height || 1;
      this.pressure = params.pressure || 0;
      this.tangentialPressure = params.tangentialPressure || 0;
      this.tiltX = params.tiltX || 0;
      this.tiltY = params.tiltY || 0;
      this.twist = params.twist || 0;
      this.pointerType = params.pointerType || 'mouse';
      this.isPrimary = params.isPrimary === undefined ? true : params.isPrimary;
    }
  }
  window.PointerEvent = PointerEventPolyfill as typeof PointerEvent;
}

if (typeof window !== 'undefined') {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (elt, pseudoElt) => {
    try {
      return originalGetComputedStyle(elt, pseudoElt);
    } catch (e) {
      const error = e as Error;
      // eslint-disable-next-line no-console
      console.warn(
        `Original getComputedStyle failed for ${elt.tagName}: ${error.message}. Using fallback.`
      );
      const properties: Record<string, string> = {
        display: 'block',
        opacity: '1',
        visibility: 'visible',
        position: 'static',
        pointerEvents: 'auto',
        animationName: 'none',
        transitionProperty: 'none',
        width: 'auto',
        height: 'auto',
        margin: '0px',
        padding: '0px',
        border: '0px none rgb(0, 0, 0)',
        overflow: 'visible',
      };
      const mockStyle = {
        ...properties,
        getPropertyValue: (propertyName: string): string => {
          const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          return properties[camelCaseProperty] || '';
        },
        length: Object.keys(properties).length,
        item: (index: number): string => Object.keys(properties)[index] || '',
        setProperty: (propertyName: string, value: string | null, _priority?: string) => {
          // _priority marked unused
          const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          if (value === null) {
            // Handle null value for setProperty
            delete properties[camelCaseProperty];
          } else {
            properties[camelCaseProperty] = value;
          }
          mockStyle.length = Object.keys(properties).length;
        },
        removeProperty: (propertyName: string): string => {
          const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          const oldValue = properties[camelCaseProperty];
          delete properties[camelCaseProperty];
          mockStyle.length = Object.keys(properties).length;
          return oldValue || '';
        },
      } as unknown as CSSStyleDeclaration; // Cast to CSSStyleDeclaration
      // Populate indexed properties
      Object.keys(properties).forEach((key, index) => {
        (mockStyle as unknown as Record<number, string>)[index] = key;
      });
      return mockStyle;
    }
  };
}

if (typeof document.createRange === 'undefined') {
  globalThis.document.createRange = () => {
    const range = new Range();
    range.getBoundingClientRect = jest.fn(
      (): DOMRect => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
      })
    );
    range.getClientRects = jest.fn(
      (): DOMRectList => ({
        item: (_index: number) => null, // _index marked unused
        length: 0,
        [Symbol.iterator]: jest.fn(),
      })
    );
    return range;
  };
}

if (typeof window !== 'undefined') {
  window.requestIdleCallback =
    window.requestIdleCallback ||
    ((cb: IdleRequestCallback): number => {
      const start = Date.now();
      return setTimeout(() => {
        cb({
          didTimeout: false,
          timeRemaining: (): number => Math.max(0, 50 - (Date.now() - start)),
        });
      }, 1) as unknown as number;
    });
  window.cancelIdleCallback =
    window.cancelIdleCallback ||
    ((id: number): void => {
      clearTimeout(id);
    });
}
