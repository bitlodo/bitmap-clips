export const ORDINALS_ORIGIN = "https://ordinals.com";

export class OrdinalsError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export class OrdinalsClient {
  constructor(
    private readonly base = ORDINALS_ORIGIN,
    private readonly fetcher: typeof fetch = fetch,
    private readonly cache: RequestCache = "default",
  ) {}

  async request(
    path: string,
    signal?: AbortSignal,
    accept = "application/json",
  ): Promise<Response> {
    signal?.throwIfAborted();
    try {
      // Invoke fetch without the client as its receiver (WorkerGlobalScope requires this).
      const fetcher = this.fetcher;
      const response = await fetcher(this.base + path, {
        headers: { Accept: accept },
        mode: "cors",
        credentials: "omit",
        cache: this.cache,
        signal: AbortSignal.any([
          AbortSignal.timeout(30_000),
          ...(signal ? [signal] : []),
        ]),
      });
      if (!response.ok) {
        throw new OrdinalsError(
          `Ordinals returned HTTP ${response.status} at ${path}. ${response.status === 429 ? "Wait and try again." : ""}`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof OrdinalsError || signal?.aborted) throw error;
      throw new OrdinalsError(
        `Could not query Ordinals (${path}). Check your connection or try again.`,
      );
    }
  }

  async json<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await this.request(path, signal);
    try {
      return (await response.json()) as T;
    } catch {
      throw new OrdinalsError(
        `The server did not return valid JSON at ${path}.`,
      );
    }
  }

  async text(path: string, signal?: AbortSignal): Promise<string> {
    return (await this.request(path, signal, "*/*")).text();
  }
}
