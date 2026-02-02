-- Create a function to search for nodes that are similar to a specific embedding
-- This function is used for semantic search and related node recommendations

create or replace function match_nodes (
  query_embedding vector(2048),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  title text,
  content text,
  graph_id uuid,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    nodes.id,
    nodes.title,
    nodes.content,
    nodes.graph_id,
    1 - (nodes.embedding <=> query_embedding) as similarity
  from nodes
  join knowledge_graphs on nodes.graph_id = knowledge_graphs.id
  where knowledge_graphs.user_id = p_user_id
  and 1 - (nodes.embedding <=> query_embedding) > match_threshold
  order by nodes.embedding <=> query_embedding
  limit match_count;
end;
$$;
