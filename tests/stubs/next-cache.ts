/**
 * Test stub for next/cache. Outside a Next request there is no cache to
 * revalidate, so caching is a pass-through and invalidation is a no-op.
 */
export function unstable_cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

export function updateTag(_tag: string): void {}
export function revalidateTag(_tag: string): void {}
export function revalidatePath(_path: string): void {}
