/**
 * Laravel `JsonResource` responses are usually `{ data: { ... } }`.
 * Paginated lists use `data` as an array — do not use this helper for those.
 */
export function unwrapDataRecord<T>(body: unknown): T {
  if (body !== null && typeof body === "object" && "data" in body) {
    const inner = (body as { data: unknown }).data;
    if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
      return inner as T;
    }
  }
  return body as T;
}
