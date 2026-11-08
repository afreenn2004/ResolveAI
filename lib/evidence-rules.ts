export interface CheckResult {
  name: string;
  passed: boolean;
  critical: boolean;
  message: string;
}

export function validateRequiredSections(
  content: string,
  requiredSections: string[]
): CheckResult {
  const headings = content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();

      // Accept Markdown headings or explicit colon-terminated headings.
      const markdownHeading = trimmed.match(/^#{1,6}\s+(.+?)\s*#*$/);
      const plainHeading = trimmed.match(/^([A-Za-z][A-Za-z\s&-]*):$/);

      return (markdownHeading?.[1] ?? plainHeading?.[1] ?? "")
        .trim()
        .toLowerCase();
    })
    .filter(Boolean);

  const missing = requiredSections.filter(
    (section) => !headings.includes(section.toLowerCase())
  );

  return {
    name: "REQUIRED_SECTIONS",
    passed: missing.length === 0,
    critical: true,
    message:
      missing.length === 0
        ? "All mandatory section headings are present."
        : `Missing mandatory section headings: ${missing.join(", ")}`,
  };
}

const KNOWN_SOURCE_IDS = [
  "SRC-001",
  "SRC-002",
  "SRC-003",
  "SRC-004",
  "SRC-005",
] as const;

export function validateCitations(
  content: string,
  minimumCitations: number
): CheckResult {
  const citationMatches = [
    ...content.matchAll(/\[(SRC-\d{3})\]/g),
  ].map((match) => match[1]);

  const uniqueCitations = [...new Set(citationMatches)];

  const invalid = uniqueCitations.filter(
    (id) =>
      !KNOWN_SOURCE_IDS.includes(
        id as (typeof KNOWN_SOURCE_IDS)[number]
      )
  );

  const validCount = uniqueCitations.length - invalid.length;

  const passed =
    invalid.length === 0 &&
    validCount >= minimumCitations;

  return {
    name: "SOURCE_CITATIONS",
    passed,
    critical: true,
    message: passed
      ? `${validCount} unique fixture citations verified.`
      : invalid.length > 0
        ? `Unknown source references: ${invalid.join(", ")}`
        : `At least ${minimumCitations} unique valid citations are required.`,
  };
}
export function containsPromptInjection(content: string): boolean {
  const suspiciousPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /ignore\s+(all\s+)?prior\s+instructions/i,
    /reveal\s+(the\s+)?system\s+prompt/i,
    /override\s+(the\s+)?system/i,
    /disregard\s+(all\s+)?rules/i,
    /you\s+are\s+now\s+(the\s+)?system/i,
    /bypass\s+(the\s+)?validation/i,
    /approve\s+this\s+(submission|payment)/i,
  ];

  return suspiciousPatterns.some((pattern) =>
    pattern.test(content)
  );
}