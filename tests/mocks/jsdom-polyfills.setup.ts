/**
 * @fileoverview JSDOM API Mocks and Polyfills for Jest.
 */

// JSDOM API Mocks
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn() as (target: Element) => void,
  unobserve: jest.fn() as (target: Element) => void,
  disconnect: jest.fn() as () => void,
}));

window.matchMedia = jest.fn().mockImplementation(
  (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn() as (
      this: MediaQueryList,
      listener: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown
    ) => void, // deprecated
    removeListener: jest.fn() as (
      this: MediaQueryList,
      listener: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown
    ) => void, // deprecated
    addEventListener: jest.fn() as <K extends keyof MediaQueryListEventMap>(
      type: K,
      listener: (this: MediaQueryList, ev: MediaQueryListEventMap[K]) => unknown,
      options?: boolean | AddEventListenerOptions
    ) => void,
    removeEventListener: jest.fn() as <K extends keyof MediaQueryListEventMap>(
      type: K,
      listener: (this: MediaQueryList, ev: MediaQueryListEventMap[K]) => unknown,
      options?: boolean | EventListenerOptions
    ) => void,
    dispatchEvent: jest.fn() as (event: Event) => boolean,
  })
);

global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback): number => {
  if (typeof cb === 'function') cb(0);
  return 0;
});
global.cancelAnimationFrame = jest.fn((_handle: number): void => {
  /* no-op */
});

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
  window.getComputedStyle = (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration => {
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
      const mockStyle: Partial<CSSStyleDeclaration> & {
        getPropertyValue: (propertyName: string) => string;
        setProperty: (propertyName: string, value: string | null, _priority?: string) => void;
        removeProperty: (propertyName: string) => string;
        item: (index: number) => string;
        // length should be handled by Object.keys(properties).length
      } = {
        getPropertyValue: (propertyName: string): string => {
          const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          return properties[camelCaseProperty] || '';
        },
        setProperty: (propertyName: string, value: string | null, _priority?: string) => {
          const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          if (value === null) {
            delete properties[camelCaseProperty];
          } else {
            properties[camelCaseProperty] = value;
          }
        },
        removeProperty: (propertyName: string): string => {
          const camelCaseProperty = propertyName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          const oldValue = properties[camelCaseProperty];
          delete properties[camelCaseProperty];
          return oldValue || '';
        },
        item: (index: number): string => Object.keys(properties)[index] || '',
      };
      Object.keys(properties).forEach((key, index) => {
        (mockStyle as Record<number, string>)[index] = key;
        if (key in mockStyle) {
          // Use a more specific type to bypass strict type checking for this dynamic assignment
          (mockStyle as { [key: string]: unknown })[key] = properties[key];
        }
      });
      Object.defineProperty(mockStyle, 'length', {
        get: () => Object.keys(properties).length,
      });

      return mockStyle as CSSStyleDeclaration;
    }
  };
}

if (typeof document.createRange === 'undefined') {
  globalThis.document.createRange = (): Range => {
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
        item: (_index: number) => null,
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

// Polyfill for HTMLImageElement to simulate image loading in JSDOM
interface HTMLImageElementWithPolyfill extends HTMLImageElement {
  _jsdomError: boolean;
  _jsdomSrcValue: string;
}

if (typeof window !== 'undefined' && typeof HTMLImageElement !== 'undefined') {
  const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'src'
  );
  const originalImageCompleteDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'complete'
  );
  const originalImageNaturalWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'naturalWidth'
  );
  const originalImageNaturalHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'naturalHeight'
  );

  Object.defineProperties(HTMLImageElement.prototype, {
    _jsdomError: {
      writable: true,
      value: false,
    },
    _jsdomSrcValue: {
      writable: true,
      value: '',
    },
    naturalHeight: {
      configurable: true,
      get(this: HTMLImageElementWithPolyfill) {
        if (originalImageNaturalHeightDescriptor?.get) {
          try {
            return originalImageNaturalHeightDescriptor.get.call(this);
          } catch (_e) {
            /*ignore*/
          }
        }
        return this._jsdomSrcValue && !this._jsdomError ? 100 : 0;
      },
    },
    naturalWidth: {
      configurable: true,
      get(this: HTMLImageElementWithPolyfill) {
        if (originalImageNaturalWidthDescriptor?.get) {
          try {
            return originalImageNaturalWidthDescriptor.get.call(this);
          } catch (_e) {
            /*ignore*/
          }
        }
        return this._jsdomSrcValue && !this._jsdomError ? 100 : 0;
      },
    },
    complete: {
      configurable: true,
      get(this: HTMLImageElementWithPolyfill) {
        if (originalImageCompleteDescriptor?.get) {
          try {
            return originalImageCompleteDescriptor.get.call(this);
          } catch (_e) {
            /*ignore*/
          }
        }
        return !!(this._jsdomSrcValue && !this._jsdomError);
      },
    },
    src: {
      configurable: true,
      enumerable: true,
      get(this: HTMLImageElementWithPolyfill) {
        return this._jsdomSrcValue;
      },
      set(this: HTMLImageElementWithPolyfill, value: string) {
        this._jsdomSrcValue = value;

        if (originalImageSrcDescriptor?.set) {
          originalImageSrcDescriptor.set.call(this, value);
        }

        this._jsdomError = false;

        if (value && String(value).trim() !== '') {
          queueMicrotask(() => {
            if (typeof this.onload === 'function') {
              (this.onload as EventListener)({
                target: this,
              } as unknown as Event);
            }
            this.dispatchEvent(new Event('load'));
          });
        } else {
          this._jsdomError = true;
          queueMicrotask(() => {
            if (typeof this.onerror === 'function') {
              (this.onerror as EventListener)({
                target: this,
              } as unknown as Event);
            }
            this.dispatchEvent(new Event('error'));
          });
        }
      },
    },
  });
}
