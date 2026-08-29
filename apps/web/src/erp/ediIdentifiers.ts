export function parseEdiIdentifiers(input: string): string[] {
  return input
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
