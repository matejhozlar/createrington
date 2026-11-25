const INTERNAL_PATH = /^\/(?![/\\])/;

export function isInternalPath(path: string): boolean {
  return INTERNAL_PATH.test(path);
}
