CREATE INDEX IF NOT EXISTS idx_prompt_results_parser_confidence ON prompt_results (parser_confidence);
CREATE INDEX IF NOT EXISTS idx_prompt_results_parser_output_gin ON prompt_results USING GIN (parser_output);
