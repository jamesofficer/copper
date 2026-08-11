// Errors thrown in the main process reach the renderer wrapped as
// "Error invoking remote method 'x': Error: <message>" — strip the wrapper
// so UI surfaces show only the real message.
export function cleanIpcError(message: string): string {
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );
}

// A thrown value as text fit to show a reader. Everything the renderer catches
// comes back over IPC, so the wrapper is always worth stripping. The fallback is
// for a rejection that carries no message of its own: "[object Object]" tells
// the reader nothing, where the caller's own wording at least names what failed.
export function errorText(cause: unknown, fallback?: string): string {
  if (cause instanceof Error && cause.message) {
    return cleanIpcError(cause.message);
  }
  if (typeof cause === "string" && cause) return cleanIpcError(cause);
  return fallback ?? String(cause);
}
