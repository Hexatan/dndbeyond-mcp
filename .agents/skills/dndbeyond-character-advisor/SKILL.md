---
name: dndbeyond-character-advisor
description: Analyze and advise D&D Beyond characters with dndbeyond-mcp tools. Use when the user asks for a character summary, spell advice, build advice, level-up guidance, ability/feat recommendations, tactical options, or explanation of what a character can do.
---

# D&D Beyond Character Advisor

## Overview

Give advice from the live character sheet first. Avoid generic class advice when `get_character` can show actual stats, spells, features, equipment, resources, and unresolved choices.

## Workflow

1. Identify the character by ID or name. If missing, ask for it.
2. Call `get_character` before giving mechanical advice. Use `detail: "sheet"` for normal advice and `detail: "full"` only when definitions are needed.
3. Match the answer to the task:
   - Summary: explain identity, stats, defenses, actions, resources, spells, equipment, and notable features.
   - Spell advice: inspect known/prepared spells, slots, class features, concentration conflicts, and the stated situation.
   - Level-up advice: identify current classes/levels, next-level features, ASI/feat points, spell changes, and subclass or feature choices.
   - Build advice: compare options against the character's current ability scores, proficiencies, gear, role, and party needs if known.
4. Call `list_class_feature_choices` when reviewing unresolved or newly unlocked
   class choices. Use its feature names, current values, and labeled options for
   proficiencies, expertise, fighting styles, invocations, spells, feats, and
   subclasses. Pass `className` for multiclass characters.
5. Use `get_definition`, `search_spells`, `get_spell`, `search_feats`, `search_class_features`, `search_items`, or `get_item` only for rules text or option details that are not already clear from the sheet.
6. Separate what the character currently has from recommendations for future changes.

## Applying Level-Up Advice

Only mutate after explicit approval. After `set_class_level`, refetch the
character and call `list_class_feature_choices`; future-level choices do not
materialize before the level change. Resolve approved choices with
`set_class_feature_choice` using `choiceKey` + `optionName`, respect eligibility
and distinct-pick requirements, then refetch until no new cascading choices
remain. Use ordinary spell tools for known/prepared spells and the class-choice
tool for spells granted by a feature.

## Output

Keep the result actionable:

- Start with the answer or recommendation.
- Include the mechanical reason.
- Note tradeoffs and resource costs.
- Give 2-4 concrete next actions when useful.

## Safety

- Do not mutate the character unless the user explicitly asks for a change and confirms it.
- If suggesting a write action, name the exact tool that would make the change.
- Do not claim D&D Beyond UI work is required until `list_class_feature_choices`
  has been checked and the relevant named option is unavailable.
