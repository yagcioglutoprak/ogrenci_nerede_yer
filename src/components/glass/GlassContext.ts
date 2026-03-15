import React, { createContext, useContext } from 'react';

/**
 * Tracks whether a component is rendered inside a glass surface.
 * Components that check useInsideGlass() will render solid instead of glass,
 * preventing glass-on-glass violations per Apple's Liquid Glass guidelines.
 */
const GlassContext = createContext(false);

export const GlassProvider = GlassContext.Provider;

export function useInsideGlass(): boolean {
  return useContext(GlassContext);
}
