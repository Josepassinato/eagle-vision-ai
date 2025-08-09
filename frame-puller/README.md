# Frame Puller - Video Stream Ingestion Service

O Frame Puller é um serviço leve que captura frames de streams de vídeo (RTSP/HLS) do MediaMTX e os envia para o Fusion API para processamento de visão computacional.

## Funcionalidades

- **Stream Input**: Suporta RTSP e HLS streams
- **Frame Extraction**: Extrai frames a 5-10 FPS configurável
- **Backpressure Handling**: Ajusta FPS automaticamente baseado na latência
- **Format Conversion**: Converte frames para JPEG base64 otimizado
- **Error Recovery**: Reconecta automaticamente em caso de falhas
- **Performance Monitoring**: Logs de latência e taxa de envio

## Configuração via ENV

```bash
# Stream source
STREAM_URL=rtsp://localhost:8554/entrada
# ou HLS: http://localhost:8888/entrada/

# Fusion API
FUSION_URL=http://fusion:8080

# Camera identification
CAMERA_ID=cam01

# Frame rate control
PULLER_FPS=8           # FPS inicial (5-10 recomendado)
MIN_FPS=3              # FPS mínimo durante backpressure
MAX_FPS=10             # FPS máximo

# Quality control
MAX_IMAGE_MB=0.5       # Tamanho máximo da imagem
LATENCY_THRESHOLD=0.5  # Threshold para reduzir FPS (500ms)

# Connection settings
RECONNECT_DELAY=5      # Delay entre tentativas de reconexão
```

## Backpressure Algorithm

O serviço implementa controle automático de FPS baseado na latência:

1. **Monitoramento**: Mantém histórico das últimas 50 latências
2. **Detecção**: Se latência média > 500ms por 3 frames consecutivos
3. **Ação**: Reduz FPS em 1 (mínimo 3 FPS)
4. **Recuperação**: Se latência < 250ms, aumenta FPS em 1 (máximo 10 FPS)
5. **Cooldown**: Ajustes apenas a cada 10 segundos

## Pipeline de Processamento

```
Stream Input → Frame Capture → BGR→RGB → JPEG Compression → Base64 Encode → Fusion API
     ↓              ↓              ↓            ↓                ↓             ↓
   RTSP/HLS    OpenCV Cap    Color Convert   Quality Opt.   Network Send   Vision AI
```

## Execução

### Docker Compose
```bash
docker-compose up frame-puller
```

### Desenvolvimento Local
```bash
# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis
export STREAM_URL=rtsp://192.168.1.100:8554/entrada
export FUSION_URL=http://localhost:8080
export CAMERA_ID=cam01

# Executar
python main.py
```

### Teste com MP4 Local
```bash
# Usar arquivo local como stream
export STREAM_URL=/path/to/video.mp4
python main.py
```

## Logs e Monitoramento

### Logs de Startup
```
INFO - FramePuller initialized - Camera: cam01, Stream: rtsp://...
INFO - Stream connected successfully - Resolution: 1920x1080
INFO - Fusion API is healthy
```

### Logs de Runtime
```
INFO - Events detected: 2 - Latency: 0.234s
WARNING - High latency detected (0.623s), reducing FPS: 8 → 7
INFO - Low latency detected (0.145s), increasing FPS: 7 → 8
```

### Estatísticas Periódicas (a cada 30s)
```
INFO - Stats - Runtime: 120.5s, Frames: 960, Success: 955 (99.5%), Errors: 5
INFO - FPS - Target: 8, Actual: 7.8
INFO - Latency - Avg: 0.234s, Max: 0.456s
```

## Troubleshooting

### Stream não conecta
```bash
# Verificar conectividade
ffprobe rtsp://your-ip:8554/entrada

# Testar com vlc
vlc rtsp://your-ip:8554/entrada
```

### Alta latência
1. Verificar capacidade do Fusion API
2. Reduzir qualidade JPEG (diminuir MAX_IMAGE_MB)
3. Verificar rede entre serviços
4. Monitorar uso de GPU nos serviços de AI

### Perda de frames
1. Verificar logs do MediaMTX
2. Aumentar buffer do stream source
3. Verificar estabilidade da rede
4. Considerar usar HLS em vez de RTSP

### Imagens muito grandes
- Reduzir MAX_IMAGE_MB (padrão: 0.5MB)
- O serviço reduz qualidade automaticamente
- Considerar resize antes da compressão

## Performance

### Typical Performance
- **Latência**: 150-300ms por frame
- **Throughput**: 8 FPS estável
- **CPU Usage**: ~10-15% por stream
- **Memory**: ~50-100MB

### Optimization Tips
1. **Quality vs Size**: MAX_IMAGE_MB = 0.5MB é um bom balanço
2. **FPS Range**: 5-8 FPS é ideal para a maioria dos casos
3. **Network**: Use conexão com baixa latência para RTSP
4. **Buffer**: Minimize buffer size para reduzir delay

## Integration with MediaMTX

### RTSP Configuration
```yaml
# mediamtx.yml
paths:
  entrada:
    source: publisher
    sourceOnDemand: yes
```

### HLS Configuration  
```yaml
# mediamtx.yml
hls: yes
hlsAddress: :8888
hlsEncryption: no
```

### Stream URLs
- **RTSP**: `rtsp://mediamtx-ip:8554/entrada`
- **HLS**: `http://mediamtx-ip:8888/entrada/`

## Error Recovery

O serviço implementa recovery automático para:

1. **Connection Loss**: Reconecta automaticamente
2. **Stream Timeout**: Reinicia captura
3. **Fusion API Errors**: Continua tentando (com backpressure)
4. **Frame Decode Errors**: Ignora frame e continua
5. **Network Issues**: Retry com exponential backoff

## Docker Compose Integration

O serviço se integra ao stack via depends_on:

```yaml
frame-puller:
  depends_on:
    - mediamtx
    - fusion
  environment:
    - STREAM_URL=rtsp://mediamtx:8554/entrada
    - FUSION_URL=http://fusion:8080
```