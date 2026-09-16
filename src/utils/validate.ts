import type { TSchema } from "elysia";
import { TypeCompiler } from "elysia/type-system";

const cache = new WeakMap<TSchema, ReturnType<typeof TypeCompiler.Compile>>();

function getValidator(schema: TSchema) {
	let v = cache.get(schema);
	if (!v) {
		v = TypeCompiler.Compile(schema);
		cache.set(schema, v);
	}
	return v;
}

export function check(schema: TSchema, value: unknown): boolean {
	return getValidator(schema).Check(value);
}

export function formatErrors(schema: TSchema, value: unknown): string {
	return [...getValidator(schema).Errors(value)]
		.map((e) => `${e.path}: ${e.message}`)
		.join("; ");
}
