# Fusion API - Person Identification Service

O Fusion API é o cérebro do sistema Visão de Águia que integra todos os componentes (YOLO, Face, Re-ID, Tracking, Motion) para tomar decisões inteligentes sobre identificação de pessoas.

## Arquitetura

```
Frame Input → YOLO Detection → Face Recognition ↘
                            → Re-ID Matching    → Decision Logic → Supabase Event
                            → Tracking         ↗
                            → Motion Analysis ↗
```

## Pipeline de Processamento

1. **Detecção YOLO**: Identifica pessoas na imagem
2. **Tracking**: Mantém IDs consistentes entre frames
3. **Motion Analysis**: Calcula deslocamento em pixels
4. **Face Recognition**: Tenta identificar por face (se possível)
5. **Re-ID Matching**: Identifica por características do corpo
6. **Decision Logic**: Aplica regras de fusão
7. **Event Publishing**: Envia eventos confirmados para Supabase

## Regras de Decisão

### Confirmação por Face
- `face_similarity >= T_FACE` (default: 0.60)
- `frames_confirmed >= N_FRAMES` (default: 15)

### Confirmação por Re-ID + Movimento
- `reid_similarity >= T_REID` (default: 0.82)
- `movement_px >= T_MOVE` (default: 3.0)
- `frames_confirmed >= N_FRAMES` (default: 15)

## Variáveis de Ambiente

```bash
# Serviços
YOLO_URL=http://yolo:18060
FACE_URL=http://face:18081
REID_URL=http://reid:18090

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
INGEST_EVENT_URL=https://your-project.functions.supabase.co/ingest_event
VISION_WEBHOOK_SECRET=your-webhook-secret

# Thresholds
T_FACE=0.60
T_REID=0.82
T_MOVE=3
N_FRAMES=15

# Limites
MAX_PEOPLE=10
MAX_IMAGE_MB=2
REQUEST_TIMEOUT=0.150
```

## API Endpoints

### GET /health
Verifica saúde do serviço e dependências.

```bash
curl http://localhost:8080/health
```

**Resposta:**
```json
{
  "status": "ok",
  "services": {
    "yolo": "ok",
    "face": "ok", 
    "reid": "ok"
  },
  "thresholds": {
    "T_FACE": 0.60,
    "T_REID": 0.82,
    "T_MOVE": 3.0,
    "N_FRAMES": 15
  }
}
```

### POST /ingest_frame
Processa um frame e retorna eventos de identificação confirmados.

```bash
curl -X POST http://localhost:8080/ingest_frame \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "cam01",
    "ts": 1723200000.123,
    "jpg_b64": "<BASE64_IMAGE>",
    "max_people": 10
  }'
```

**Resposta:**
```json
{
  "events": [
    {
      "camera_id": "cam01",
      "person_id": "550e8400-e29b-41d4-a716-446655440000",
      "reason": "face",
      "face_similarity": 0.85,
      "reid_similarity": null,
      "frames_confirmed": 18,
      "movement_px": 5.2,
      "ts": "2025-08-09T14:00:00.123Z"
    }
  ]
}
```

### GET /metrics
Métricas Prometheus para monitoramento.

```bash
curl http://localhost:8080/metrics
```

## Métricas Disponíveis

- `fusion_infer_seconds`: Tempo de inferência por estágio (yolo, face, reid, tracking)
- `fusion_decisions_total`: Total de decisões por razão (face, reid+motion)
- `fusion_similarity_face`: Distribuição de similaridades faciais
- `fusion_similarity_reid`: Distribuição de similaridades Re-ID

## Execução

### Docker Compose
```bash
docker-compose up fusion
```

### Desenvolvimento Local
```bash
# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
export YOLO_URL=http://localhost:18060
export FACE_URL=http://localhost:18081
export REID_URL=http://localhost:18090
# ... outras variáveis

# Executar
python main.py
```

## Troubleshooting

### Latência Alta
1. Verificar timeouts dos serviços (REQUEST_TIMEOUT)
2. Monitorar métricas `fusion_infer_seconds`
3. Ajustar número máximo de pessoas (MAX_PEOPLE)

### Identificações Incorretas
1. Ajustar thresholds (T_FACE, T_REID)
2. Verificar qualidade das imagens de entrada
3. Aumentar número mínimo de frames (N_FRAMES)

### Serviços Indisponíveis
1. Verificar `/health` endpoint
2. Conferir URLs e conectividade de rede
3. Validar logs dos microserviços dependentes

### Eventos Não Chegam ao Supabase
1. Verificar INGEST_EVENT_URL e VISION_WEBHOOK_SECRET
2. Monitorar logs da Edge Function ingest_event
3. Confirmar configuração de CORS na Edge Function

## Logs Estruturados

O serviço produz logs detalhados para cada decisão:
```
INFO: Event confirmed: track_id=123, person_id=uuid, reason=face, 
      face_sim=0.85, reid_sim=None, frames=18, move_px=5.20
```

## Performance

- **Latência alvo**: < 200ms por frame
- **Throughput**: Suporta múltiplas câmeras concorrentemente
- **Escalabilidade**: Stateless, pode ser replicado horizontalmente