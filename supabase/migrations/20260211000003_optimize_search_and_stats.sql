-- Enable pg_trgm for fast text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN indexes for efficient LIKE/ILIKE searches
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_title_trgm ON knowledge_graphs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nodes_title_trgm ON nodes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nodes_content_trgm ON nodes USING gin (content gin_trgm_ops);

-- RPC for aggregated study statistics
-- Replaces multiple heavy queries in statistics.ts
CREATE OR REPLACE FUNCTION get_user_study_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'metrics', (
            SELECT jsonb_build_object(
                'totalCards', COUNT(*),
                'dueToday', COUNT(*) FILTER (WHERE next_review <= (CURRENT_DATE + TIME '23:59:59')),
                'learning', COUNT(*) FILTER (WHERE fsrs_state IN (1, 3)), -- Learning(1) + Relearning(3)
                'avgStability', COALESCE(ROUND(AVG(fsrs_stability) FILTER (WHERE fsrs_state != 0)::numeric, 1), 0.0)
            )
            FROM study_cards
            WHERE user_id = p_user_id
        ),
        'distribution', (
            SELECT jsonb_agg(item)
            FROM (
                SELECT 
                    fsrs_state, 
                    COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id
                GROUP BY fsrs_state
            ) t CROSS JOIN LATERAL (
                SELECT jsonb_build_object(
                    'state', fsrs_state,
                    'count', count
                ) as item
            ) sub
        ),
        'heatmap', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT last_reviewed::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id 
                AND last_reviewed >= (CURRENT_DATE - INTERVAL '365 days')
                AND last_reviewed IS NOT NULL
                GROUP BY last_reviewed::date
            ) t
        ),
        'growth', (
             SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT created_at::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id 
                AND created_at >= (CURRENT_DATE - INTERVAL '30 days')
                GROUP BY created_at::date
            ) t
        ),
        'forecast', (
             SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT next_review::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id 
                AND next_review >= CURRENT_DATE 
                AND next_review <= (CURRENT_DATE + INTERVAL '7 days')
                GROUP BY next_review::date
            ) t
        )
    ) INTO result;
    
    RETURN result;
END;
$$;
