// import { expect } from 'vitest';
// import matchers from '@testing-library/jest-dom/matchers';

// Import jest-dom for its side effects (automatically extends expect)
import '@testing-library/jest-dom';

// Extend Vitest's expect method with methods from react-testing-library
// expect.extend(matchers); 

// Only apply DOM polyfills when in a browser-like environment (not in Node environment)
if (typeof window !== 'undefined') {
  // Basic polyfill for PointerEvent methods missing in JSDOM (as of current versions)
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function(pointerId: number): boolean {
      // Mock implementation - adjust if needed based on Radix behavior
      // This basic version might be enough to prevent the TypeError
      // console.warn('JSDOM PointerEvent polyfill: hasPointerCapture called', pointerId);
      return false; 
    };
  }

  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function(pointerId: number): void {
      // Mock implementation
      // console.warn('JSDOM PointerEvent polyfill: setPointerCapture called', pointerId);
    };
  }

  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function(pointerId: number): void {
      // Mock implementation
      // console.warn('JSDOM PointerEvent polyfill: releasePointerCapture called', pointerId);
    };
  }

  // scrollIntoView polyfill (basic mock)
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function(arg?: boolean | ScrollIntoViewOptions): void {
      // Mock implementation - does nothing, but prevents the TypeError
      // console.warn('JSDOM polyfill: scrollIntoView called', arg);
    };
  }
}

// Add any other global test setup here if needed 