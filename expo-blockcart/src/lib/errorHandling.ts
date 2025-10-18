import { PostgrestError } from "@supabase/supabase-js";

export interface SupabaseErrorResponse {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Parses various error types and returns a user-friendly error message
 */
export function parseError(error: unknown): ApiError {
  // Handle Supabase PostgrestError
  if (error && typeof error === "object" && "message" in error) {
    const supabaseError = error as PostgrestError;
    return {
      message: supabaseError.message,
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  // Handle objects with message property
  if (error && typeof error === "object" && "message" in error) {
    return {
      message: String((error as any).message),
    };
  }

  // Fallback for unknown error types
  return {
    message: "An unexpected error occurred",
  };
}

/**
 * Formats error messages for display to users
 */
export function formatErrorMessage(error: unknown): string {
  const parsedError = parseError(error);

  // Handle specific Supabase error codes with user-friendly messages
  switch (parsedError.code) {
    case "42703":
      return "Database error: The requested information could not be found.";
    case "23505":
      return "This information already exists. Please try again with different details.";
    case "23503":
      return "Cannot complete this action due to related data constraints.";
    case "42501":
      return "You do not have permission to perform this action.";
    case "PGRST116":
      return "The requested resource was not found.";
    case "PGRST301":
      return "You are not authorized to access this resource.";
    default:
      // Return the original message if it's user-friendly, otherwise provide a generic message
      if (
        parsedError.message &&
        !parsedError.message.includes("column") &&
        !parsedError.message.includes("relation")
      ) {
        return parsedError.message;
      }
      return "Something went wrong. Please try again.";
  }
}

/**
 * Checks if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  const parsedError = parseError(error);
  const message = parsedError.message.toLowerCase();

  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("offline")
  );
}

/**
 * Checks if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  const parsedError = parseError(error);
  const message = parsedError.message.toLowerCase();

  return (
    message.includes("auth") ||
    message.includes("unauthorized") ||
    message.includes("token") ||
    message.includes("session") ||
    parsedError.code === "42501" ||
    parsedError.code === "PGRST301"
  );
}

/**
 * Wrapper function for Supabase operations with error handling
 */
export async function handleSupabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  errorContext?: string
): Promise<T> {
  const { data, error } = await operation();

  if (error) {
    const formattedError = new Error(
      errorContext
        ? `${errorContext}: ${formatErrorMessage(error)}`
        : formatErrorMessage(error)
    );
    (formattedError as any).originalError = error;
    throw formattedError;
  }

  if (data === null) {
    throw new Error(
      errorContext ? `${errorContext}: No data returned` : "No data returned"
    );
  }

  return data;
}

/**
 * Wrapper function for Supabase operations that might return null
 */
export async function handleSupabaseOperationNullable<T>(
  operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  errorContext?: string
): Promise<T | null> {
  const { data, error } = await operation();

  if (error) {
    const formattedError = new Error(
      errorContext
        ? `${errorContext}: ${formatErrorMessage(error)}`
        : formatErrorMessage(error)
    );
    (formattedError as any).originalError = error;
    throw formattedError;
  }

  return data;
}
