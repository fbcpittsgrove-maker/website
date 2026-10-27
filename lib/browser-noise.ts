/** Errors raised by the visitor's browser rather than this site: a
 *  cross-origin script the browser hides ("Script error." with no stack),
 *  or a script an in-app browser or wallet extension injects into every page
 *  (Facebook/Instagram wallet probes, Chrome and Edge on iOS). */
const INJECTED = /\bwindow\.ethereum\b|__gCrWeb|instantSearchSDKJSBridgeClearHighlight|webkit\.messageHandlers/;

export function isBrowserNoise(message: string, stack?: string): boolean {
  if (/^Script error\.?$/.test(message.trim()) && !stack) return true;
  return INJECTED.test(message) || (stack !== undefined && INJECTED.test(stack));
}
