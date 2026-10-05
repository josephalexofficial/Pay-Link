import { AppError, ConfigurationError } from "@/common/errors/app-error";
import { logger } from "@/common/logging/logger";

type FieldIssue = {
  field: string;
  issue: string;
};

type ErrorBody = {
  code: string;
  message: string;
  details?: FieldIssue[];
};

/**
 * Builds the standard success envelope used by Whimsey API routes.
 *
 * @param data - Response payload.
 * @param requestId - Id echoed in meta so a caller can quote one request.
 * @returns JSON body with success, data, and meta.
 */
export function successEnvelope<T>(data: T, requestId: string): {
  success: true;
  data: T;
  meta: { timestamp: string; requestId: string };
} {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

/**
 * Converts a thrown value into the public JSON error response.
 * Configuration details stay in the log. Callers see a short safe sentence.
 *
 * @param error - Unknown failure from a route or service.
 * @param requestId - Id echoed in meta.
 * @returns A Response with the matching HTTP status and error envelope.
 */
export function toErrorResponse(error: unknown, requestId: string): Response {
  if (error instanceof AppError && error.isOperational) {
    const message = error instanceof ConfigurationError ? "Payments are not available right now." : error.message;
    logger.warn("Request rejected", {
      requestId,
      errorCode: error.errorCode,
      message: error.message,
    });

    return Response.json(errorEnvelope(error.errorCode, message, requestId, readFieldIssues(error.metadata)), {
      status: error.statusCode,
    });
  }

  logger.error("Unhandled request failure", {
    requestId,
    error: error instanceof Error ? error.message : "Unknown error",
  });

  return Response.json(
    errorEnvelope("INTERNAL_ERROR", "Something went wrong. Try again in a moment.", requestId),
    { status: 500 },
  );
}

function errorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details?: FieldIssue[],
): { success: false; error: ErrorBody; meta: { timestamp: string; requestId: string } } {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

function readFieldIssues(metadata: Record<string, unknown> | undefined): FieldIssue[] | undefined {
  const details = metadata?.details;
  if (!Array.isArray(details)) {
    return undefined;
  }

  return details.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const field = "field" in entry && typeof entry.field === "string" ? entry.field : "";
    const issue = "issue" in entry && typeof entry.issue === "string" ? entry.issue : "";
    if (!field || !issue) {
      return [];
    }

    return [{ field, issue }];
  });
}

/**
 * Creates a request id for one API call.
 *
 * @returns A UUID string.
 */
export function createRequestId(): string {
  return crypto.randomUUID();
}
