import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerCharacterCreatorPrompt(server: McpServer): void {
  server.prompt(
    "character-creator",
    "Guide the user through creating a D&D Beyond character",
    {
      concept: z
        .string()
        .optional()
        .describe("Optional starting character concept, party role, or build idea"),
    },
    async (args) => {
      const concept = args.concept?.trim();
      const conceptText = concept
        ? `The user is starting from this concept: "${concept}".`
        : "The user has not provided a starting concept yet.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Help me create a D&D Beyond character through a conversational workflow.

${conceptText}

Use this process:
1. Ask short, concrete questions. Ask only 1-2 questions at a time.
2. Collect the essentials before creating anything: name, level, class, species/race, background, ability score method, and source/preference choices.
3. Use reference tools to look up IDs before write calls:
   - search_classes for class IDs
   - search_races for species/race entity IDs and entity type IDs
   - search_backgrounds for background IDs
4. Before calling create_character, summarize the selected build and ask for explicit confirmation.
5. Prefer create_character with method "standard", then apply choices with update_character_name, add_class, set_species, set_background, set_ability_score_type, set_ability_score, set_starting_equipment_type, set_gold, set_character_appearance, update_description, set_character_preferences, and set_character_source_categories as needed.
6. After builder mutations, call get_character to inspect current state and unresolved choices.
7. If the user wants automatic completion, call resolve_choices only after explaining it picks the first available option for unresolved builder choices.
8. Do not invent IDs or unsupported options. If a choice cannot be set with the available tools, say what remains for the D&D Beyond UI.
9. End with the character ID, a concise build summary, and any remaining manual steps.

Keep the workflow practical. Do not create or delete characters without explicit user approval.`,
            },
          },
        ],
      };
    }
  );
}
