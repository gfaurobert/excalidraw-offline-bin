export interface ZenityChoiceOption {
  id: string;
  label: string;
}

/** zenity 3.42 treats U+2014 in `--title=` as an extra flag ("not available"). */
export function normalizeZenityCliText(value: string): string {
  return value.replace(/\u2014/g, "-");
}

/** zenity exits 255 with this text when a flag is invalid for the active dialog mode. */
export function isZenityUnsupportedOptionError(detail?: string): boolean {
  if (!detail) return false;
  return detail.includes("This option is not available");
}

export function parseZenityVersion(
  raw: string,
): { major: number; minor: number; patch: number } | null {
  const m = raw.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

/** Multi-select checklist layouts, richest compatible first. */
export type ZenityMultiSelectVariant = "hidden-id" | "label-only";

export function zenityMultiSelectVariantOrder(
  _version: { major: number; minor: number; patch: number } | null,
): ZenityMultiSelectVariant[] {
  return ["hidden-id", "label-only"];
}

/**
 * Build zenity checklist argv. Avoid --width/--height: GTK4 zenity often rejects
 * sizing flags combined with --list (zenity: "This option is not available").
 */
export function buildZenityMultiSelectChecklistArgs(
  variant: ZenityMultiSelectVariant,
  title: string,
  text: string,
  options: ZenityChoiceOption[],
  defaultCheckedIds: string[] = [],
): string[] {
  const checked = new Set(defaultCheckedIds);
  const safeTitle = normalizeZenityCliText(title);
  const safeText = normalizeZenityCliText(text);
  const args = [
    "zenity",
    "--list",
    "--checklist",
    `--title=${safeTitle}`,
    `--text=${safeText}`,
  ];

  if (variant === "hidden-id") {
    args.push(
      "--column=Select",
      "--column=ID",
      "--column=Target",
      "--hide-header",
      "--hide-column=2",
      "--print-column=2",
    );
    for (const opt of options) {
      args.push(
        checked.has(opt.id) ? "TRUE" : "FALSE",
        opt.id,
        opt.label,
      );
    }
    return args;
  }

  args.push(
    "--column=Select",
    "--column=Target",
    "--hide-header",
    "--print-column=2",
  );
  for (const opt of options) {
    args.push(checked.has(opt.id) ? "TRUE" : "FALSE", opt.label);
  }
  return args;
}
