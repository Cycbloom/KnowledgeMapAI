-- Migration: Add auto_graph prompt templates (progressive generation)
-- Two templates: auto_graph_init (initial) and auto_graph_expand (expand nodes)

INSERT INTO "public"."prompt_templates" ("code", "scope", "user_id", "graph_id", "template_content", "created_at", "updated_at") VALUES 
(
  'auto_graph_init',
  'system',
  null,
  null,
  'You are a knowledge graph expert. Initialize a new knowledge graph based on the given topic.

## Task
Generate the ROOT node and 3-5 CORE nodes for the topic. This is the FIRST step of progressive graph building.

## Style Guidelines
{{#if isAcademic}}
### Academic Style (学术风格)
- Use professional terminology and academic language
- Focus on accurate definitions and theoretical frameworks
- Include relevant theories and principles
{{else}}
{{#if isPractical}}
### Practical Style (实用风格)
- Use plain, easy-to-understand language
- Focus on practical application scenarios
- Include examples and best practices
{{else}}
### Beginner Style (入门风格)
- Use simple, easy-to-understand language
- Use analogies and real-life examples
- Each concept should have a concise explanation
{{/if}}
{{/if}}

{{#if hasSources}}
## Reference Sources
Use the following sources as reference:
{{sources}}
{{/if}}

Topic: {{topic}}

Respond in Chinese.',
  NOW(),
  NOW()
),
(
  'auto_graph_expand',
  'system',
  null,
  null,
  'You are a knowledge graph expert. Expand a node by generating its child nodes.

## Task
Generate 3-5 child nodes for the given parent node. Each child should be a specific sub-concept or detail.

## Context
- Parent Node: {{nodeTitle}}
{{#if nodeContent}}- Parent Content: {{nodeContent}}{{/if}}
- Parent Level: {{nodeLevel}}

## Style Guidelines
{{#if isAcademic}}
### Academic Style (学术风格)
- Use professional terminology
- Focus on theoretical aspects
- Include relevant principles
{{else}}
{{#if isPractical}}
### Practical Style (实用风格)
- Use plain language
- Focus on practical applications
- Include examples
{{else}}
### Beginner Style (入门风格)
- Use simple language
- Use analogies
- Keep explanations concise
{{/if}}
{{/if}}

{{#if hasExistingChildren}}
## Existing Children
The following child nodes already exist: {{existingChildren}}
Generate NEW, DIFFERENT child nodes.
{{/if}}

Respond in Chinese.',
  NOW(),
  NOW()
);

COMMENT ON TABLE prompt_templates IS 'Prompt templates with priority: graph > user > system';
