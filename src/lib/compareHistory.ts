export type CompareDiffView = {
  previousLineCount: number;
  currentLineCount: number;
  commonPrefixLines: number;
  commonSuffixLines: number;
  previousChangedLines: string[];
  currentChangedLines: string[];
  changed: boolean;
};

export function buildCompareDiffView(previousText: string, currentText: string): CompareDiffView {
  const previousLines = normalizeLines(previousText);
  const currentLines = normalizeLines(currentText);

  let commonPrefixLines = 0;
  while (
    commonPrefixLines < previousLines.length &&
    commonPrefixLines < currentLines.length &&
    previousLines[commonPrefixLines] === currentLines[commonPrefixLines]
  ) {
    commonPrefixLines += 1;
  }

  let commonSuffixLines = 0;
  while (
    commonSuffixLines < previousLines.length - commonPrefixLines &&
    commonSuffixLines < currentLines.length - commonPrefixLines &&
    previousLines[previousLines.length - 1 - commonSuffixLines] ===
      currentLines[currentLines.length - 1 - commonSuffixLines]
  ) {
    commonSuffixLines += 1;
  }

  const previousChangedLines = previousLines.slice(
    commonPrefixLines,
    previousLines.length - commonSuffixLines,
  );
  const currentChangedLines = currentLines.slice(
    commonPrefixLines,
    currentLines.length - commonSuffixLines,
  );

  return {
    previousLineCount: previousLines.length,
    currentLineCount: currentLines.length,
    commonPrefixLines,
    commonSuffixLines,
    previousChangedLines,
    currentChangedLines,
    changed:
      previousChangedLines.length > 0 ||
      currentChangedLines.length > 0 ||
      previousLines.length !== currentLines.length,
  };
}

function normalizeLines(value: string) {
  return value.replace(/\r\n?/g, '\n').split('\n');
}
