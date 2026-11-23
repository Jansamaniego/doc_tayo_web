/**
 * The contract does not declare path parameters yet (backend request D-30), so the generated types
 * forbid `params.path` even though the API needs it. This is the one place that works around it:
 * remove it when the contract declares them and the types accept `params: { path }` directly.
 */
export function pathParams(path: Record<string, string>): { params: never } {
  return { params: { path } as never };
}
