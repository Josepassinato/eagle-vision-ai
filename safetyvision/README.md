# SafetyVision – Segurança do Trabalho

Microserviço para monitoramento de EPI, zonas de risco e comportamentos inseguros em canteiros e plantas industriais.

## Endpoints
- POST /analyze_frame
- POST /notify_clip
- GET  /health

## Variáveis de Ambiente
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_ROLE)
- SAFETY_NOTIFY_MIN_SEVERITY (default: HIGH)
- SAFETY_WEBHOOK_URL (opcional)
- SAFETY_FRAME_STORE / SAFETY_CLIP_STORE (opcional)
- ALLOWED_ORIGINS (CORS)

## Persistência
- safety_signals: sinais atômicos (missing_ppe, unauthorized_zone, unsafe_lifting, fall_suspected)
- safety_incidents: agregação com severidade e status (open/ack/closed)

## Execução local
```
uvicorn main:app --host 0.0.0.0 --port 8089 --reload
```
