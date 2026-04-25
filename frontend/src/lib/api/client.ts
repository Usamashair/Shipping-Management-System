export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export class ApiError extends Error {
  readonly status: number;

  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** Merged after Accept; Authorization and Content-Type still applied when set below. */
  headers?: Record<string, string>;
};

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (e) {
    const base = getApiBaseUrl();
    const isNetworkFail =
      e instanceof TypeError &&
      (e.message === "Failed to fetch" || e.message.toLowerCase().includes("fetch"));
    const message = isNetworkFail
      ? `Cannot reach API at ${base}. Start the Laravel server and check NEXT_PUBLIC_API_URL (CORS must allow this origin).`
      : e instanceof Error
        ? e.message
        : "Network request failed.";
    throw new ApiError(message, 0, { networkError: true, url, cause: String(e) });
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = { message: text };
    }
  }

  if (!res.ok) {
    const msg =
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : res.statusText;
    throw new ApiError(msg || "Request failed", res.status, parsed);
  }

  return (parsed ?? null) as T;
}
