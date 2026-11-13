/**
 * How a medium is shown. The languages table only has lower-case names ("english", "hindi"), so the native label
 * and the letter on its tile come from here, keyed by name (never by id). Unknown names show capitalised.
 */
export interface MediumLabel {
  /** In its own script: "हिन्दी". */
  native: string;
  /** In English: "Hindi" (same as native for English). */
  english: string;
  /** The tile letter: "अ". */
  letter: string;
}

const KNOWN: Record<string, MediumLabel> = {
  english: { native: 'English', english: 'English', letter: 'A' },
  hindi: { native: 'हिन्दी', english: 'Hindi', letter: 'अ' },
};

export function mediumLabel(name: string): MediumLabel {
  const key = name.trim().toLowerCase();
  const known = KNOWN[key];
  if (known) return known;
  const capitalised = key.charAt(0).toUpperCase() + key.slice(1);
  return { native: capitalised, english: capitalised, letter: capitalised.charAt(0) };
}
