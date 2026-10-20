// Never send raw input, diagnoses, model output or SDK error bodies to platform logs.
export const privacyConsole=Object.freeze({
 log(){},
 warn(){globalThis.console.warn('[CHJ] server warning');},
 error(){globalThis.console.error('[CHJ] server error');}
});
