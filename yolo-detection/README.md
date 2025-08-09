# YOLO Person Detection Service

Microserviço de detecção de pessoas usando YOLOv8/v10 para o projeto Visão de Águia.

## Funcionalidades

- Detecção de pessoas em imagens usando YOLO
- API REST com FastAPI
- Suporte a GPU NVIDIA
- Validação de entrada e tratamento de erros
- Coordenadas normalizadas e absolutas

## Requisitos

- Docker com suporte a NVIDIA
- GPU NVIDIA (opcional, funciona com CPU)
- Docker Compose

## Instalação e Execução

### 1. Configurar NVIDIA Container Toolkit (se usar GPU)

```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### 2. Construir e executar

```bash
cd yolo-detection
docker-compose up --build
```

### 3. Testar

```bash
# Health check
curl http://localhost:18060/health

# Teste com imagem (substitua <BASE64> por uma imagem real)
curl -X POST http://localhost:18060/detect \
  -H "Content-Type: application/json" \
  -d '{"jpg_b64":"<BASE64_IMAGE>"}'
```

## API Endpoints

### GET /health

Verifica status do serviço.

**Resposta:**
```json
{
  "status": "ok",
  "model": "yolov8x.pt",
  "device": "cuda",
  "gpu_available": true
}
```

### POST /detect

Detecta pessoas em uma imagem.

**Request:**
```json
{
  "jpg_b64": "<base64_encoded_jpeg>"
}
```

**Response:**
```json
{
  "boxes": [
    {
      "score": 0.93,
      "cls": "person",
      "xyxy": [100, 50, 200, 300],
      "xywhn": [0.234, 0.125, 0.156, 0.625]
    }
  ]
}
```

**Campos:**
- `score`: Confiança da detecção (0-1)
- `cls`: Sempre "person"
- `xyxy`: Coordenadas absolutas [x1, y1, x2, y2]
- `xywhn`: Coordenadas normalizadas [x_center, y_center, width, height]

## Configuração

### Variáveis de Ambiente

- `YOLO_MODEL`: Modelo YOLO a usar (default: `yolov8x.pt`)

### Limites

- Tamanho máximo da imagem: 2MB
- Timeout de inferência: 2s
- Formato suportado: JPEG

## Testes

```bash
cd yolo-detection
pip install pytest requests
python test_detection.py
```

## Exemplo Completo

```bash
# Converter imagem para base64
base64 -w 0 person.jpg > image.b64

# Criar payload
echo '{"jpg_b64":"'$(cat image.b64)'"}' > payload.json

# Fazer detecção
curl -X POST http://localhost:18060/detect \
  -H "Content-Type: application/json" \
  -d @payload.json
```

## Performance

- **Latência esperada**: ≤ 60ms por frame (1080p, 1 pessoa, YOLOv8x, GPU)
- **Throughput**: Varia conforme GPU e tamanho da imagem
- **Warm-up**: Primeira inferência pode ser mais lenta

## Troubleshooting

### GPU não detectada
```bash
# Verificar drivers NVIDIA
nvidia-smi

# Verificar Docker com GPU
docker run --rm --gpus all nvidia/cuda:12.1-runtime-ubuntu22.04 nvidia-smi
```

### Container não inicia
- Verificar se NVIDIA Container Toolkit está instalado
- Verificar se Docker suporta GPUs
- Logs: `docker-compose logs yolo-detection`

### Latência alta
- Verificar se está usando GPU
- Considerar modelo menor (yolov8s.pt, yolov8m.pt)
- Verificar se há concorrência de GPU

## Próximos Passos

1. Integrar com Fusion API
2. Adicionar batch processing
3. Implementar cache de resultados
4. Métricas de performance