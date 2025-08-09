-- Create IVFFlat indexes with lists=200 for faster ANN
CREATE INDEX IF NOT EXISTS idx_people_face_embedding_ivfflat
ON public.people USING ivfflat (face_embedding vector_cosine_ops)
WITH (lists = 200);

CREATE INDEX IF NOT EXISTS idx_people_body_embedding_ivfflat
ON public.people USING ivfflat (body_embedding vector_cosine_ops)
WITH (lists = 200);

ANALYZE public.people;