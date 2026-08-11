/** Deep-freeze for immutable parsed domain objects. */

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) {
      deepFreeze(v);
    }
  }
  return value;
}
