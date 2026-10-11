import type { Configuration } from "../config.js";

export async function readForm(request: Request): Promise<URLSearchParams> {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    throw new Error("Invalid form encoding");
  }
  const reader = request.body?.getReader();
  if (!reader) {
    throw new Error("Missing form");
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      size += chunk.value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new Error("Form too large");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new URLSearchParams(new TextDecoder().decode(body));
}
export function assertSameOrigin(request: Request, configuration: Configuration): void {
  if (request.headers.get("origin") !== configuration.PUBLIC_ORIGIN) {
    throw new Error("Invalid form origin");
  }
}
