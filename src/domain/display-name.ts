/** Storage bound. Keep in sync with profiles_display_name_len. */
export const DISPLAY_NAME_MAX_LENGTH = 80;

/** Blank becomes null. Throws if the trimmed name is too long. */
export function normalizeDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`);
  }
  return trimmed;
}
