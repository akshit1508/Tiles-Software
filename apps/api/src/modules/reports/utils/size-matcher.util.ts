/**
 * Escapes regex metacharacters in a raw string to prevent ReDoS and regex injection.
 */
export function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Builds a safe, anchored, case-insensitive RegExp for flexible tile size matching.
 *
 * Rules:
 * - Tolerates interchangeable dimension separators (*, x, X, × \u00D7) and surrounding whitespace.
 * - Preserves unit information (e.g. "16x16 mm" matches "16*16 mm" or "16 X 16 MM",
 *   but will NEVER match "16x16 ft" or unitless "16x16").
 * - Escapes all user input metacharacters safely.
 * - Anchors strictly to string start (^) and end ($).
 */
export function buildSizeRegex(rawInput: string): RegExp {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return /^$/;
  }

  // Dimension separator pattern: *, x, X, ×, optionally surrounded by spaces
  const separatorRegex = /\s*[*xX×]\s*/;

  // Split on dimension separators
  const parts = trimmed.split(separatorRegex);

  // If no dimension separator was present, do an exact, safely-escaped match
  if (parts.length <= 1) {
    const escaped = trimmed.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`^${escaped}$`, 'i');
  }

  // Escape each part so units/numbers/labels are treated as literal characters
  const escapedParts = parts.map((part) => {
    const tokens = part.split(/\s+/).filter(Boolean);
    return tokens
      .map((tok) => tok.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'))
      .join('\\s+');
  });

  // Rejoin with flexible dimension separator pattern:
  // optional whitespace, any dimension separator (*, x, X, ×), optional whitespace
  const flexibleSeparator = '\\s*[*xX×]\\s*';
  const pattern = `^${escapedParts.join(flexibleSeparator)}$`;

  return new RegExp(pattern, 'i');
}
