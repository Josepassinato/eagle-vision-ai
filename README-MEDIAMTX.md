# 🎥 MediaMTX Server Setup - Eagle Vision

Este guia te ajuda a configurar um servidor MediaMTX completo para streaming de câmeras IP.

## 🚀 Início Rápido

### 1. Iniciar o MediaMTX
```bash
# Iniciar o servidor MediaMTX
docker-compose -f docker-compose.mediamtx.yml up -d

# Verificar se está rodando
docker ps
```

### 2. Configurar suas Câmeras

**Opção A: Câmera IP via RTSP (Pull)**
```yaml
# Edite mediamtx.yml e adicione:
paths:
  camera1:
    source: rtsp://admin:senha@192.168.1.100:554/stream1
    sourceOnDemand: yes
    sourceProtocol: tcp
```

**Opção B: Publish via RTMP (Push)**
```bash
# Publique da sua câmera para:
rtmp://localhost:1935/camera1
```

### 3. Acessar os Streams

| Protocolo | URL de Acesso |
|-----------|---------------|
| **HLS (Web)** | `http://localhost:8080/hls/camera1/index.m3u8` |
| **RTSP** | `rtsp://localhost:8554/camera1` |
| **WebRTC** | `http://localhost:8889/camera1` |

## 🔧 URLs e Portas

### Portas Expostas
- **8554**: RTSP Server
- **8080**: HLS via Nginx (recomendado para web)
- **8888**: HLS direto do MediaMTX  
- **8889**: WebRTC
- **9997**: API de controle
- **9998**: Métricas

### APIs Úteis
```bash
# Listar streams ativos
curl http://localhost:9997/v3/paths/list

# Status de uma câmera específica
curl http://localhost:9997/v3/paths/get/camera1

# Métricas do sistema
curl http://localhost:9998/metrics
```

## 📝 Configuração Eagle Vision

Após o MediaMTX estar rodando, configure no Eagle Vision:

1. **No segredo MEDIAMTX_PUBLIC_BASE:**
```
http://localhost:8080
```

2. **No cadastro de câmeras:**
- **RTSP URL**: `rtsp://admin:senha@IP:554/stream1`
- **Stream será disponível em**: `http://localhost:8080/hls/CAMERA_ID/index.m3u8`

## 🎛️ Recursos Avançados

### Gravação Automática
```yaml
# Em mediamtx.yml
paths:
  camera1:
    source: rtsp://admin:senha@192.168.1.100:554/stream1
    record: yes
    recordPath: /recordings/%path/%Y-%m-%d_%H-%M-%S
```

### Autenticação
```yaml
# Em mediamtx.yml  
paths:
  camera_privada:
    source: rtsp://admin:senha@192.168.1.100:554/stream1
    readUser: viewer
    readPass: senha123
    publishUser: publisher
    publishPass: pub123
```

## 🔍 Troubleshooting

### Verificar Logs
```bash
# Logs do MediaMTX
docker logs eagle-mediamtx

# Logs do Nginx
docker logs eagle-nginx-hls
```

### Testar Conectividade
```bash
# Testar RTSP
ffplay rtsp://localhost:8554/camera1

# Testar HLS
curl -I http://localhost:8080/hls/camera1/index.m3u8

# Verificar API
curl http://localhost:9997/v3/config/global/get
```

**MediaMTX configurado com sucesso! 🎉**