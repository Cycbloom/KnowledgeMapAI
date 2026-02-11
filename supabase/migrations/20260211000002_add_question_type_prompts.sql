-- Add specific prompt templates for different question types

INSERT INTO prompt_templates (code, scope, template_content) VALUES 
('generate_cards_qa', 'system', 
'For ''qa'' type: Create thought-provoking open-ended questions that test deep understanding. 
Provide a detailed ''explanation'' analyzing the answer.
Focus on explaining the "Why" and "How" rather than just "What".'),

('generate_cards_choice', 'system', 
'For ''choice'' type: Create multiple-choice questions with 4 plausible options. 
Provide the correct answer and a detailed ''explanation'' of why it is correct and others are wrong.
Distractors should be common misconceptions if possible.'),

('generate_cards_true_false', 'system', 
'For ''true_false'' type: Create statements focusing on common misconceptions or key details. 
Provide a detailed ''explanation'' clarifying the fact.'),

('generate_cards_multi_choice', 'system', 
'For ''multi_choice'' type: Create multiple-choice questions where ONE OR MORE options can be correct. 
Provide 4 options, the ''answer'' as a JSON array of correct strings, and a detailed ''explanation''.'),

('generate_cards_fill_blank', 'system', 
'For ''fill_in_the_blank'' type: Create a sentence with one or more ''___'' (3 underscores) as blanks. 
The ''answer'' should be the missing text. Provide a detailed ''explanation''.'),

('generate_cards_essay', 'system', 
'For ''essay'' type: Create complex questions requiring a long-form structured answer. 
The ''answer'' should be a model response with key points. 
Provide a detailed ''explanation'' with scoring criteria and key concepts to cover.')
ON CONFLICT DO NOTHING;
