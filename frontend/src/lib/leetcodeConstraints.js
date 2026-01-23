// src/lib/leetcodeConstraints.js

function normalize(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/1e(\d+)/gi, "10^$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function leetCodeConstraints(constraints = []) {
  if (!Array.isArray(constraints)) return [];

  const priority = [
    "length",
    "size",
    "[i]",
    "value",
    "sorted",
    "distinct",
  ];

  return constraints
    .map(normalize)
    .sort((a, b) => {
      const ai = priority.findIndex(p => a.includes(p));
      const bi = priority.findIndex(p => b.includes(p));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}
