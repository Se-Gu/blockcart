import { useCallback } from "react";
import { useToast } from "../components/ToastProvider";
import { parseError, formatErrorForConsole } from "../lib/errorParser";

export interface UseErrorHandlerOptions {
  showToast?: boolean;
  toastDuration?: number;
  context?: string;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { showToast = true, toastDuration = 5000, context } = options;
  const { showError, showWarning, showInfo } = useToast();

  const handleError = useCallback(
    (error: unknown, customContext?: string) => {
      const errorContext = customContext || context;
      const parsedError = parseError(error);

      // Add context to the message if provided
      const finalMessage = errorContext
        ? `${errorContext}: ${parsedError.message}`
        : parsedError.message;

      if (showToast) {
        // Show error toast
        showError(finalMessage, toastDuration);
      }

      // Log the original error for debugging
      console.error("Error handled:", {
        originalError: error,
        parsedError,
        formattedMessage: finalMessage,
        context: errorContext,
      });

      return parsedError;
    },
    [showToast, toastDuration, context, showError]
  );

  const handleAsyncError = useCallback(
    async <T>(
      asyncOperation: () => Promise<T>,
      customContext?: string
    ): Promise<T | null> => {
      try {
        return await asyncOperation();
      } catch (error) {
        handleError(error, customContext);
        return null;
      }
    },
    [handleError]
  );

  return {
    handleError,
    handleAsyncError,
  };
}
