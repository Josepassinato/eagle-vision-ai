# Notifier Service - Visão de Águia

Microserviço para envio de notificações Telegram quando a Fusion confirma eventos.

## Funcionalidades

- ✅ Recebe eventos da Fusion via POST `/notify_event`
- ✅ Envia foto + resumo via Telegram Bot API
- ✅ Rate limiting (10 msgs/min por câmera)
- ✅ Fallback para captura de snapshot via ffmpeg
- ✅ Suporte a múltiplos chat IDs
- ✅ Logs estruturados
- ✅ Timeout configurável (3s padrão)

## Configuração

### Variáveis de Ambiente

```bash
TELEGRAM_BOT_TOKEN=<obrigatório>     # Token do bot Telegram
TELEGRAM_CHAT_ID=<obrigatório>       # Chat ID ou lista: id1,id2,id3
STREAM_SNAPSHOT_URL=http://mediamtx:8888/simulador/index.m3u8  # URL para snapshot
NOTIFIER_TIMEOUT_MS=3000             # Timeout em milliseconds
TELEGRAM_PARSE_MODE=HTML             # Modo de parse (HTML ou Markdown)
```

### Setup do Bot Telegram

1. Fale com [@BotFather](https://t.me/botfather) no Telegram
2. Crie um novo bot com `/newbot`
3. Copie o token fornecido
4. Para descobrir o Chat ID:
   - Adicione o bot ao chat/grupo
   - Envie uma mensagem
   - Acesse: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Procure pelo `chat.id` na resposta

## API

### POST `/notify_event`

Recebe eventos confirmados da Fusion:

```json
{
  "camera_id": "cam01",
  "person_id": "uuid-or-null",
  "person_name": "optional",
  "reason": "face|reid+motion",
  "face_similarity": 0.61,
  "reid_similarity": 0.86,
  "frames_confirmed": 17,
  "movement_px": 4.3,
  "ts": "2025-08-09T14:00:00Z",
  "jpg_b64": "<frame_base64_optional>"
}
```

### GET `/health`

Status do serviço:

```json
{
  "status": "ok",
  "telegram_configured": true,
  "chat_ids_count": 2,
  "stream_url": "http://mediamtx:8888/simulador/index.m3u8",
  "timeout_ms": 3000
}
```

## Mensagem Telegram

Formato enviado:

```
[Visão de Águia]
Câmera: cam01 | 14:00:00
Motivo: face
Face: 0.61 | ReID: 0.86
Pessoa: João Silva
Frames: 17 | Move: 4.3px
```

## Rate Limiting

- Máximo 10 mensagens por minuto por `camera_id`
- Evita spam em caso de detecções contínuas
- Status 429 retornado quando limite excedido

## Logs

Logs estruturados em JSON:

```json
{
  "event": "notification_sent",
  "camera_id": "cam01",
  "reason": "face",
  "chat_ids": ["123456", "789012"],
  "success_count": 2,
  "total_chats": 2,
  "lat_ms": 1250.5,
  "has_image": true
}
```