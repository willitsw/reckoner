export function processTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed || 'Untitled';
}
