const SEPARATOR = ":";

type FieldValues<F extends readonly string[]> = { [K in F[number]]: string };

type BuildArgs<F extends readonly string[]> = F extends readonly []
  ? []
  : [values: { [K in F[number]]: string | number }];

export interface CustomIdMatcher {
  readonly prefix: string;
  matches(customId: string): boolean;
}

export interface CustomId<F extends readonly string[]> extends CustomIdMatcher {
  build(...args: BuildArgs<F>): string;
  parse(customId: string): FieldValues<F> | null;
}

export function defineCustomId<const F extends readonly string[] = readonly []>(
  prefix: string,
  fields: F = [] as unknown as F,
): CustomId<F> {
  const head = `${prefix}${SEPARATOR}`;

  function parse(customId: string): FieldValues<F> | null {
    if (fields.length === 0) {
      return customId === prefix ? ({} as FieldValues<F>) : null;
    }

    if (!customId.startsWith(head)) return null;

    const parts = customId.slice(head.length).split(SEPARATOR);
    if (parts.length < fields.length) return null;

    const last = fields.length - 1;
    const values = [...parts.slice(0, last), parts.slice(last).join(SEPARATOR)];
    if (values.some((value) => value === "")) return null;

    return Object.fromEntries(
      fields.map((field, index) => [field, values[index]]),
    ) as FieldValues<F>;
  }

  function build(...args: BuildArgs<F>): string {
    const [values] = args as [Record<string, string | number>?];
    if (!values) return prefix;
    return [prefix, ...fields.map((field) => String(values[field]))].join(
      SEPARATOR,
    );
  }

  return {
    prefix,
    build,
    parse,
    matches: (customId) => parse(customId) !== null,
  };
}
