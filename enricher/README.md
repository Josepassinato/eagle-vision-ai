# Enricher - Auto-Enriquecimento de Rostos

Serviço Python que escuta eventos confirmados e enriquece a base de rostos automaticamente:

- Critério: reason="face" e face_similarity >= T_FACE + 0.05
- Qualidade: det_score >= 0.9 e altura da face >= 140px (via InsightFace-REST)
- Gera novo embedding, aplica EMA no `people.face_embedding` e mantém até K=10 vistas em `people_faces`
- Métricas Prometheus: `enricher_updates_total{person_id}` e outras
- Rotas admin protegidas por `x-api-key`

## Variáveis
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- FACE_URL (padrão http://face-service:18080)
- T_FACE (padrão 0.60), DELTA_FACE (padrão 0.05)
- K (padrão 10), EMA_ALPHA (padrão 0.30)
- STREAM_SNAPSHOT_URL (padrão http://mediamtx:8888/simulador/index.m3u8)
- POLL_INTERVAL_SEC (padrão 1.0)
- ADMIN_API_KEY (para rotas /admin)

## Endpoints
- GET /health
- GET /metrics
- GET /admin/people/{person_id}/faces (header x-api-key)
- DELETE /admin/people/{person_id}/faces/last (header x-api-key)

## Execução local
```
docker compose up -d enricher
```

## Testes rápidos
- Verifique métricas: http://localhost:8086/metrics
- Liste vistas: `curl -H 'x-api-key: SECRETO' http://localhost:8086/admin/people/<uuid>/faces`
- Remova última: `curl -X DELETE -H 'x-api-key: SECRETO' http://localhost:8086/admin/people/<uuid>/faces/last`
