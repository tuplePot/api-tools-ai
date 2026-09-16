import type { TSchema } from "elysia";
import type { SkillFrontmatter } from "../../skills.generated";
import { SKILLS_DATA } from "../../skills.generated";

export type SkillEntry = {
	frontmatter: SkillFrontmatter;
	input: TSchema;
	output: TSchema;
	systemPrompt: string;
	render: (input: unknown) => string;
	refine?: (output: unknown, input: unknown) => unknown;
};

const skillMap = new Map<string, SkillEntry>();

export abstract class Registry {
	static boot(): void {
		for (const skill of SKILLS_DATA) {
			skillMap.set(skill.frontmatter.id, skill);
		}
		console.log(
			`[Registry] loaded ${skillMap.size}: ${[...skillMap.keys()].join(", ")}`,
		);
	}

	static getAll(): SkillEntry[] {
		return [...skillMap.values()];
	}

	static get(id: string): SkillEntry | undefined {
		return skillMap.get(id);
	}
}
