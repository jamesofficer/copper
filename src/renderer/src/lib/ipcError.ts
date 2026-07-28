// Errors thrown in the main process reach the renderer wrapped as
// "Error invoking remote method 'x': Error: <message>" — strip the wrapper
// so UI surfaces show only the real message.
export function cleanIpcError(message: string): string {
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );
}
