export function toScreamingSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

export type ToScreamingSnakeCase<S extends string> =
  S extends `${infer T}${infer U}`
    ? U extends Uncapitalize<U>
      ? `${Uppercase<T>}${ToScreamingSnakeCase<U>}`
      : `${Uppercase<T>}_${ToScreamingSnakeCase<U>}`
    : S;
