# Visão de Águia - Gateway de Mídia (MediaMTX)

Sistema de streaming de mídia usando MediaMTX para receber e distribuir feeds de câmeras IP via múltiplos protocolos.

## 🚀 Como usar

### Subir o serviço:
```bash
docker compose up -d
docker compose logs -f mediamtx
```

### Testar leitura da rota entrada:

**HLS no navegador:**
```
http://SEU_IP:8888/entrada/
```

**VLC RTSP:**
```
rtsp://leitor:leitor123@SEU_IP:8554/entrada
```

### Testar push RTMP (se usar o path push-demo):

**Exemplo com FFmpeg (arquivo local -> RTMP):**
```bash
ffmpeg -re -stream_loop -1 -i sample.mp4 -c copy -f flv rtmp://SEU_IP:1935/push-demo?user=pub&pass=pub123
```

**Ler via RTSP:**
```bash
vlc rtsp://leitor:leitor123@SEU_IP:8554/push-demo
```

## 🔧 Configuração

### Portas necessárias no firewall:
- **8554/tcp** - RTSP
- **1935/tcp** - RTMP  
- **8888/tcp** - HLS
- **8889/tcp** - WebRTC signaling
- **8890/udp** - SRT
- **UDP 8000–8200** - WebRTC mídia

### Adicionar novas câmeras:

1. Edite o arquivo `mediamtx.yml`
2. Adicione um novo path na seção `paths:`

**Exemplo para câmera IP (PULL):**
```yaml
paths:
  camera1:
    source: rtsp://usuario:senha@192.168.1.100:554/stream1
    sourceOnDemand: yes
    sourceProtocol: tcp
    readUser: leitor
    readPass: leitor123
```

**Exemplo para stream PUSH:**
```yaml
paths:
  stream1:
    publishUser: publisher
    publishPass: pub123
    readUser: leitor
    readPass: leitor123
```

### Usar push (enviar stream):

**RTMP:**
```bash
ffmpeg -re -i input.mp4 -c copy -f flv rtmp://SEU_IP:1935/NOME_DO_PATH?user=PUBLISH_USER&pass=PUBLISH_PASS
```

**SRT:**
```bash
ffmpeg -re -i input.mp4 -c copy -f mpegts srt://SEU_IP:8890?streamid=NOME_DO_PATH&user=PUBLISH_USER&pass=PUBLISH_PASS
```

## 📋 Critérios de aceite

- ✅ `docker compose up -d` sobe sem erros
- ✅ Consigo tocar `rtsp://leitor:leitor123@SEU_IP:8554/entrada` no VLC
- ✅ HLS disponível em `http://SEU_IP:8888/entrada/`
- ✅ README explica como adicionar novas câmeras e como usar push

## 🔒 Notas de segurança

- Altere as credenciais padrão antes de usar em produção
- Em ambiente cloud, configure adequadamente o Security Group
- WebRTC requer portas UDP amplas (8000–8200)
- Para máxima compatibilidade, mantenha `network_mode: host`

## 🐛 Troubleshooting

### Container não inicia:
```bash
docker compose logs mediamtx
```

### Não consegue conectar:
1. Verifique se as portas estão abertas no firewall
2. Teste conectividade com telnet: `telnet SEU_IP 8554`
3. Verifique logs do MediaMTX

### Stream não funciona:
1. Verifique credenciais de acesso
2. Teste primeiro com arquivo local
3. Confirme formato de URL da câmera IP