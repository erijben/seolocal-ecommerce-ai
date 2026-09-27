import axios from "axios";

type ErrorBody = {
  request_id?: unknown;
  detail?: unknown;
};

function asRequestId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getRequestIdFromError(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const headerRequestId = asRequestId(
    error.response?.headers?.["x-request-id"],
  );

  if (headerRequestId) {
    return headerRequestId;
  }

  const data = error.response?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const body = data as ErrorBody;
  const bodyRequestId = asRequestId(body.request_id);

  if (bodyRequestId) {
    return bodyRequestId;
  }

  if (
    body.detail &&
    typeof body.detail === "object" &&
    !Array.isArray(body.detail)
  ) {
    return asRequestId((body.detail as ErrorBody).request_id);
  }

  return null;
}

export function addRequestReference(message: string, error: unknown): string {
  const requestId = getRequestIdFromError(error);

  return requestId ? `${message} Référence : ${requestId}` : message;
}
