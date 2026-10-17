export type CriterionBands = {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRange: number;
  pronunciation: number;
};

export function getShortAnswerBandPenalty(wordCount: number): number {
  if (wordCount < 7) return 3;
  if (wordCount < 10) return 2.5;
  if (wordCount < 12) return 2;
  if (wordCount < 15) return 1.5;
  if (wordCount < 18) return 1;
  if (wordCount < 22) return 0.5;
  return 0;
}

export function getInappropriateVocabularyCount(transcript: string): number {
  // Conservative fallback for common collocation errors. The AI evaluator
  // handles context-specific misuse and reports each instance separately.
  const patterns = [
    /\bdo(?:es|ing|ne)?\s+(?:a|the)\s+decision\b/gi,
    /\bmake(?:s|ing)?\s+(?:a|the)?\s*homework\b/gi,
    /\bdiscuss(?:es|ed|ing)?\s+about\b/gi,
    /\bdepend(?:s|ed|ing)?\s+of\b/gi,
    /\bstrong\s+rain\b/gi,
    /\bmore\s+better\b/gi,
    /\bvery\s+interest\s+in\b/gi,
  ];
  return patterns.reduce((count, pattern) => count + [...transcript.matchAll(pattern)].length, 0);
}

export function capCriterionBands(bands: CriterionBands): CriterionBands {
  const toHalf = (value: number) => Math.floor(Math.max(1, Math.min(9, value)) * 2) / 2;
  const normalized = {
    fluencyCoherence: toHalf(bands.fluencyCoherence),
    lexicalResource: toHalf(bands.lexicalResource),
    grammaticalRange: toHalf(bands.grammaticalRange),
    pronunciation: toHalf(bands.pronunciation),
  };
  const values = Object.values(normalized);
  const lowest = Math.min(...values);
  const cap = lowest <= 5 ? 6 : lowest <= 5.5 ? 6.5 : 9;
  const roundDownHalf = (value: number) => Math.min(value, cap);
  return {
    fluencyCoherence: roundDownHalf(normalized.fluencyCoherence),
    lexicalResource: roundDownHalf(normalized.lexicalResource),
    grammaticalRange: roundDownHalf(normalized.grammaticalRange),
    pronunciation: roundDownHalf(normalized.pronunciation),
  };
}
