# 🦅 Eagle Vision AI - Deployment Guide

Este guia implementa o plano de deployment completo em 10 passos para colocar o Eagle Vision AI em produção.

## 📋 Pré-requisitos

- Docker & Docker Compose instalados
- Acesso ao Supabase (projeto já configurado)
- Conta Stripe (para billing)
- Conta Telegram (para notificações)

## 🚀 Deploy Automático

```bash
# 1. Clone e execute deploy
git clone <seu-repo>
cd eagle-vision-ai
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# 2. Configure banco de dados
psql -h db.avbswnnywjyvqfxezgfl.supabase.co -U postgres -d postgres < scripts/setup-demo.sql

# 3. Health check
./scripts/health-check.sh <SUA_API_KEY>
```

## 📊 Deploy Manual (Passo a Passo)

### 1. 🗄️ Migrações & RLS

```sql
-- Todas as migrações já foram aplicadas ✅
-- Próximo: configurar org demo

-- Execute o script SQL:
psql < scripts/setup-demo.sql

-- Copie o ORG_ID retornado e configure:
INSERT INTO quotas (org_id, max_streams, max_storage_gb, max_minutes_month) 
VALUES ('<ORG_ID>', 4, 20, 5000);

INSERT INTO org_api_keys (org_id, name, secret) 
VALUES ('<ORG_ID>', 'demo-key', encode(gen_random_bytes(32), 'hex'))
RETURNING secret; -- Salve este API_KEY
```

### 2. ⚙️ Configuração de Secrets

No painel Supabase > Project Settings > Edge Functions > Manage secrets:

```bash
STRIPE_SECRET_KEY=sk_test_...
TELEGRAM_BOT_TOKEN=...
```

### 3. 🎥 Subir Serviços Core

```bash
# MediaMTX + YouTube Proxies
docker-compose up -d mediamtx ytproxy_people ytproxy_vehicles ytproxy_safety ytproxy_classroom

# Verificar streams
ffprobe -v error -show_streams rtsp://localhost:8554/yt_people
```

### 4. 🤖 AI Services

```bash
# Subir analytics
docker-compose up -d yolo-detection face-service reid multi-tracker
docker-compose up -d fusion analytics notifier enricher clip-exporter
```

### 5. 📊 Monitoring

```bash
# Subir observabilidade  
docker-compose up -d prometheus grafana

# Acessar dashboards
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9090
```

## 🧪 Smoke Tests

### 5.1 Edge Functions

```bash
# Testar org-create
curl -X POST https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/org-create \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org","plan":"starter"}'

# Testar camera-add
curl -X POST https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/camera-add \
  -H "X-API-Key: <SUA_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"camera_id":"test_cam","name":"Test Camera","stream_url":"rtsp://test"}'

# Testar usage-summary
curl -X GET "https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/usage-summary?month=2025-01" \
  -H "X-API-Key: <SUA_API_KEY>"
```

### 5.2 Demo Streams

```bash
# Verificar cada analítico (5min cada)
# PeopleVision: contador deve subir/baixar, FPS ~10-15
ffplay rtsp://localhost:8554/yt_people

# VehicleVision: detecção consistente
ffplay rtsp://localhost:8554/yt_vehicles

# SafetyVision: simular zona crítica
ffplay rtsp://localhost:8554/yt_safety

# EduBehavior: telemetria de afeto via WebSocket
ffplay rtsp://localhost:8554/yt_classroom
```

### 5.3 Frontend Demo

1. Abrir painel → "Demonstração"
2. Selecionar "YT People Demo"
3. Ver overlay de detecções em ~1-2s
4. Verificar WebSocket de eventos funcionando

## 📈 Billing & Medição

```bash
# Ativar worker de uso (executar a cada 5min)
curl -X POST https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/billing-meter

# Verificar métricas
psql -c "
SELECT org_id, sum(minutes) as m, sum(frames) as f
FROM usage_events 
WHERE ts_start > now() - interval '1 hour'
GROUP BY 1;
"
```

## 🔐 Security & Privacy

### Configurar Compliance

```sql
-- Configurar blur opcional
UPDATE privacy_settings 
SET face_blur_enabled = true, license_plate_blur_enabled = true
WHERE org_id = '<ORG_ID>';

-- Configurar retenção por plano
UPDATE retention_policies 
SET retention_days = 30 
WHERE org_id = '<ORG_ID>' AND data_type = 'clips';
```

### RBAC & Audit

```sql
-- Configurar roles
INSERT INTO user_roles (user_id, role) VALUES
  ('<USER_ID>', 'admin'),
  ('<USER_ID_2>', 'operator');

-- Verificar audit logs
SELECT action, resource_type, timestamp, user_id 
FROM audit_logs 
WHERE org_id = '<ORG_ID>' 
ORDER BY timestamp DESC LIMIT 10;
```

## 🏥 Monitoramento

### Health Checks

```bash
# Script automatizado
./scripts/health-check.sh <SUA_API_KEY>

# Manual - serviços
curl http://localhost:8554/v1/config/global/get  # MediaMTX
curl http://localhost:9090/-/healthy             # Prometheus  
curl http://localhost:3000/api/health            # Grafana

# Edge Functions
curl https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/org-create
```

### Alertas

```bash
# Configurar alertas básicos:
# - "Sem frames há 30s"
# - "FPS < 5 por 60s"  
# - "Erro de ingest/ffmpeg restart loop"
```

## 🔄 Rollback Plan

### Parar Demos

```bash
# Parar só as demos
docker-compose stop ytproxy_people ytproxy_vehicles ytproxy_safety ytproxy_classroom

# Reverter seeds
psql -c "UPDATE demo_sources SET active=false WHERE protocol='RTSP' AND location LIKE 'YouTube%';"

# Desvincular streams
psql -c "UPDATE streams SET status='stopped' WHERE org_id='<ORG_ID>';"
```

### Rollback Completo

```bash
# Parar tudo
docker-compose down

# Remover dados (CUIDADO!)
docker-compose down -v

# Restaurar backup
# psql < backup.sql
```

## 📱 Mobile (iPad)

```bash
# Para usar no iPad
npm install
npx cap add ios
npx cap update ios
npm run build
npx cap sync
npx cap run ios

# Ou acesse direto no Safari:
# https://bbc6b6ad-b591-47dd-9777-42f2f4bf6fef.lovableproject.com
```

## 🎯 URLs de Acesso

| Serviço | URL | Credenciais |
|---------|-----|-------------|
| **Frontend** | https://bbc6b6ad-b591-47dd-9777-42f2f4bf6fef.lovableproject.com | - |
| **Grafana** | http://localhost:3000 | admin/admin |
| **Prometheus** | http://localhost:9090 | - |
| **MediaMTX** | http://localhost:8554 | - |

## 📺 Streams Demo

| Analítico | RTSP URL |
|-----------|----------|
| **People Count** | rtsp://localhost:8554/yt_people |
| **Vehicle Detection** | rtsp://localhost:8554/yt_vehicles |
| **Safety Monitoring** | rtsp://localhost:8554/yt_safety |
| **Edu Behavior** | rtsp://localhost:8554/yt_classroom |

## 🆘 Troubleshooting

### Problemas Comuns

```bash
# Container não inicia
docker logs <container_name>

# Stream não funciona  
ffprobe -v error rtsp://localhost:8554/yt_people

# Edge Function erro
# Verificar logs no Supabase Dashboard > Edge Functions > Logs

# Database connection
psql -h db.avbswnnywjyvqfxezgfl.supabase.co -U postgres

# Reset completo
docker-compose down -v
docker system prune -f
./scripts/deploy.sh
```

### Logs Importantes

```bash
# AI Services
docker logs fusion
docker logs yolo-detection

# Media
docker logs mediamtx
docker logs ytproxy_people

# Monitoring  
docker logs prometheus
docker logs grafana
```

## 🏆 Deploy Complete!

Após seguir este guia, você terá:

✅ Sistema completo funcionando  
✅ 4 demos YouTube streaming  
✅ AI analytics em tempo real  
✅ Billing & compliance configurado  
✅ Monitoring & alertas  
✅ Mobile ready (iPad)  
✅ Edge Functions ativas  
✅ RLS & security implementado  

🎉 **Eagle Vision AI está pronto para produção!**