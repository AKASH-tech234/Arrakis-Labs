

export function formatExampleInput(input) {
  if (typeof input !== "string") return input;

  const trimmed = input.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      return Object.entries(obj)
        .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
        .join(", ");
    } catch {
      return input;
    }
  }

  return input;
}
