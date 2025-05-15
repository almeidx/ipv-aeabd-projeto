import dedent from "dedent";

export function sql(literals: TemplateStringsArray, ...values: string[]): string {
	return dedent(literals, ...values);
}
