import type { AuthError } from "@supabase/supabase-js";

export interface ParsedError {
  title: string;
  message: string;
  code?: string;
  isUserFriendly: boolean;
}

/**
 * Parses various types of errors and returns user-friendly messages
 */
export function parseError(error: unknown): ParsedError {
  // Handle Supabase Auth errors
  if (error && typeof error === "object" && "code" in error) {
    const authError = error as AuthError;
    return parseAuthError(authError);
  }

  // Handle regular Error objects
  if (error instanceof Error) {
    return parseGenericError(error);
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      title: "Error",
      message: error,
      isUserFriendly: true,
    };
  }

  // Handle unknown error types
  return {
    title: "Unexpected Error",
    message: "An unexpected error occurred. Please try again.",
    isUserFriendly: true,
  };
}

/**
 * Parses Supabase Auth errors and returns user-friendly messages
 */
function parseAuthError(error: AuthError): ParsedError {
  const { code, message } = error;

  switch (code) {
    case "user_already_exists":
      return {
        title: "Account Already Exists",
        message:
          "An account with this email already exists. Please try signing in instead.",
        code,
        isUserFriendly: true,
      };

    case "invalid_credentials":
      return {
        title: "Invalid Credentials",
        message:
          "The email or password you entered is incorrect. Please try again.",
        code,
        isUserFriendly: true,
      };

    case "email_not_confirmed":
      return {
        title: "Email Not Confirmed",
        message:
          "Please check your email and click the confirmation link before signing in.",
        code,
        isUserFriendly: true,
      };

    case "weak_password":
      return {
        title: "Weak Password",
        message: "Password must be at least 6 characters long.",
        code,
        isUserFriendly: true,
      };

    case "invalid_email":
      return {
        title: "Invalid Email",
        message: "Please enter a valid email address.",
        code,
        isUserFriendly: true,
      };

    case "signup_disabled":
      return {
        title: "Sign Up Disabled",
        message:
          "New account registration is currently disabled. Please contact support.",
        code,
        isUserFriendly: true,
      };

    case "too_many_requests":
      return {
        title: "Too Many Attempts",
        message:
          "Too many failed attempts. Please wait a moment before trying again.",
        code,
        isUserFriendly: true,
      };

    case "network_error":
      return {
        title: "Connection Error",
        message:
          "Unable to connect to the server. Please check your internet connection.",
        code,
        isUserFriendly: true,
      };

    default:
      // For unknown auth error codes, try to use the message if it's user-friendly
      const isUserFriendlyMessage =
        message &&
        !message.includes("Error") &&
        !message.includes("Exception") &&
        message.length < 100;

      return {
        title: "Authentication Error",
        message: isUserFriendlyMessage
          ? message
          : "An authentication error occurred. Please try again.",
        code,
        isUserFriendly: true,
      };
  }
}

/**
 * Parses generic Error objects
 */
function parseGenericError(error: Error): ParsedError {
  const message = error.message;

  // Check for common error patterns
  if (message.includes("Network Error") || message.includes("fetch")) {
    return {
      title: "Connection Error",
      message:
        "Unable to connect to the server. Please check your internet connection.",
      isUserFriendly: true,
    };
  }

  if (message.includes("permission denied") || message.includes("42501")) {
    return {
      title: "Permission Denied",
      message:
        "You don't have permission to perform this action. Please contact support.",
      isUserFriendly: true,
    };
  }

  if (message.includes("relation") && message.includes("does not exist")) {
    return {
      title: "Database Error",
      message: "A database table is missing. Please contact support.",
      isUserFriendly: true,
    };
  }

  // For other errors, check if the message looks user-friendly
  const isUserFriendlyMessage =
    message &&
    !message.includes("Error") &&
    !message.includes("Exception") &&
    !message.includes("at ") &&
    message.length < 200;

  return {
    title: "Error",
    message: isUserFriendlyMessage
      ? message
      : "An unexpected error occurred. Please try again.",
    isUserFriendly: true,
  };
}

/**
 * Formats an error for display in console (for debugging)
 */
export function formatErrorForConsole(error: unknown): string {
  if (error && typeof error === "object") {
    return JSON.stringify(error, null, 2);
  }
  return String(error);
}
