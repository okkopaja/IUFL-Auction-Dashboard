interface NameSource {
  name: string | null | undefined;
}

export function normalizeNameForPlayerImport(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildNormalizedIconNameSet(rows: NameSource[]): Set<string> {
  const names = new Set<string>();

  for (const row of rows) {
    const normalized = normalizeNameForPlayerImport(row.name);
    if (!normalized) continue;
    names.add(normalized);
  }

  return names;
}

export function isIconName(
  name: string | null | undefined,
  iconNameSet: ReadonlySet<string>,
): boolean {
  const normalized = normalizeNameForPlayerImport(name);
  return normalized.length > 0 && iconNameSet.has(normalized);
}

export function filterRowsByIconName<T extends NameSource>(
  rows: T[],
  iconNameSet: ReadonlySet<string>,
): T[] {
  return rows.filter((row) => isIconName(row.name, iconNameSet));
}
