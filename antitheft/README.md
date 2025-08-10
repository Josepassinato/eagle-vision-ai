# Antitheft Service

Serviço de Antissefurto com lógica de zonas, classificação e exportação de clipes.

## Funcionalidades
- Detecção por zonas pré-definidas via polígonos (table `antitheft_zones` no Supabase)
- Classificação LOW/HIGH por regras:
  - Concealment dwell (HIGH)
  - High-value dwell seguido de saída em até `EXIT_GRACE_MIN` (HIGH)
  - Shelf-out (LOW)
  - Cart pushout próximo da saída (HIGH)
- Registro de sinais (`antitheft_signals`) e incidentes (`antitheft_incidents`)
- Replay/export: grava MP4 do HLS e publica MP4 + JSON em `antitheft_clips/{incident_id}/video.mp4` e `antitheft_clips/{incident_id}/labels.json`
- Integração com Notifier (`/notify_event` e `/notify_clip`)

## Variáveis de ambiente
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- NOTIFIER_URL (default http://notifier:8085)
- HLS_URL (default http://mediamtx:8888/simulador/index.m3u8)
- ANTITHEFT_BUCKET=antitheft_clips
- ANTITHEFT_EXPORT_DURATION=10
- SHELF_OUT_DELTA=2
- CONCEALMENT_DWELL_S=2
- EXIT_GRACE_MIN=10
- CART_PUSHOUT_DIFF=3
- HIGH_VALUE_DWELL_S=20

## Endpoints
- POST /track_update
- POST /export_incident
- GET /health
- GET /metrics

## Execução local
```
uvicorn main:app --host 0.0.0.0 --port 8088 --reload
```
