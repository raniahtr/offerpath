/** Joins class names, skipping falsy ones: cx("a", busy && "b") -> "a" or "a b". */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
