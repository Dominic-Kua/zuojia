/**
 * Create a structured error response following the IPC envelope format
 * @param {string} code - Error code (ENOENT, PERMISSION_DENIED, MISSING_DEPENDENCY, etc.)
 * @param {string} message - Human-readable error message
 * @param {string} suggestion - Optional: what user should do to resolve
 * @param {object} context - Optional: additional context (stack trace, file path, etc.)
 * @returns {object} Error response envelope
 */
export function createError(code, message, suggestion = null, context = null) {
  return {
    status: 'error',
    error: {
      code,
      message,
      suggestion,
      context,
    },
    timestamp: new Date().toISOString(),
  };
}
