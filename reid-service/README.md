# Person Re-ID Service (OSNet) - Visão de Águia

Serviço de Person Re-Identification usando OSNet em ONNX Runtime para identificação corporal quando reconhecimento facial não está disponível.

## Funcionalidades

- Extração de embeddings corporais (512D) usando OSNet
- Matching corporal via RPC do Supabase  
- Suporte a GPU NVIDIA com ONNX Runtime
- Pré-processamento consistente RGB/BGR
- API REST com FastAPI

## Arquitetura

### Modelo OSNet
- **Arquitetura**: OSNet x0.75 ou x1.0
- **Input**: 3x256x128 (RGB por padrão)
- **Output**: 512D embedding L2-normalizado
- **Performance**: ~10-15ms por inferência (GPU)

### Pré-processamento
1. Decode base64 → numpy array
2. Crop opcional (xyxy coordinates)
3. Resize para 256x128
4. Normalização ImageNet (mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225])
5. Conversão NCHW + float32

## Instalação e Setup

### 1. Obter modelo OSNet

```bash
# Criar diretório de modelos
mkdir -p reid-service/models

# Baixar modelo OSNet convertido para ONNX
# (Substitua pela URL correta do modelo)
wget -O reid-service/models/osnet_x0_75.onnx \
  "https://github.com/KaiyangZhou/deep-person-reid/releases/download/v1.0.0/osnet_x0_75.onnx"

# Ou converter de PyTorch:
# python convert_osnet_to_onnx.py --model osnet_x0_75 --output models/osnet_x0_75.onnx
```

### 2. Configurar variáveis de ambiente

```bash
export SUPABASE_URL="https://avbswnnywjyvqfxezgfl.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"
export REID_MODEL_PATH="/models/osnet_x0_75.onnx"
export REID_INPUT_FORMAT="RGB"
```

### 3. Subir o serviço

```bash
cd reid-service
docker-compose up --build -d
```

### 4. Verificar status

```bash
# Health check
curl http://localhost:18090/health

# Logs
docker-compose logs -f reid
```

## API Endpoints

### GET /health

Verifica status do serviço e configuração.

**Resposta:**
```json
{
  "status": "ok",
  "model": "/models/osnet_x0_75.onnx",
  "model_loaded": true,
  "input_format": "RGB",
  "providers": ["CUDAExecutionProvider", "CPUExecutionProvider"],
  "supabase_configured": true
}
```

### POST /embedding

Gera embedding corporal a partir de imagem.

**Request:**
```json
{
  "jpg_b64": "<base64_encoded_jpeg>",
  "xyxy": [100, 50, 200, 300]  // opcional: coordenadas de crop
}
```

**Response:**
```json
{
  "vec": [0.123, -0.456, 0.789, ...],  // 512 floats
  "norm": 1.0000  // norma L2 (deve ser ~1.0)
}
```

### POST /match

Encontra corpos similares no banco de dados.

**Request:**
```json
{
  "jpg_b64": "<base64_encoded_jpeg>",
  "top_k": 5,
  "xyxy": [100, 50, 200, 300]  // opcional
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid-da-pessoa",
      "name": "Nome da Pessoa",
      "similarity": 0.87
    }
  ]
}
```

## Cliente Python

### Uso Básico

```python
from reid_service.reid_client import ReIDClient

# Inicializar cliente
client = ReIDClient("http://localhost:18090")

# Health check
health = client.health_check()
print(health)

# Gerar embedding de um crop corporal
with open("person_crop.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

embedding = client.embed_body(img_b64)
print(f"Embedding: {len(embedding)} dimensões")

# Buscar corpos similares
matches = client.match_body(img_b64, top_k=5)
for match in matches:
    print(f"Pessoa: {match['name']}, Similaridade: {match['similarity']:.3f}")

# Com coordenadas de crop
xyxy = [100, 50, 200, 300]  # bbox do YOLO
embedding = client.embed_body(img_b64, xyxy=xyxy)
```

### Funções Utilitárias

```python
from reid_service.reid_client import embed_body, match_body

# Gerar embedding diretamente
embedding = embed_body(img_b64, xyxy=[100, 50, 200, 300])

# Fazer matching diretamente  
matches = match_body(img_b64, top_k=3)
```

## Integração com Pipeline

### Workflow Típico

1. **YOLO Detection** → detecta pessoa e retorna bbox
2. **Crop Body** → recorta região corporal
3. **OSNet Re-ID** → gera embedding 512D
4. **Supabase Match** → busca via RPC match_body
5. **Resultado** → identidade + similaridade

### Exemplo de Integração

```python
import base64
from yolo_service.detection_client import detect_persons
from reid_service.reid_client import match_body

# 1. Detectar pessoas
with open("frame.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

detections = detect_persons(img_b64)

# 2. Para cada pessoa detectada
for detection in detections:
    bbox = detection["xyxy"]  # [x1, y1, x2, y2]
    
    # 3. Fazer Re-ID matching
    matches = match_body(img_b64, top_k=5, xyxy=bbox)
    
    if matches:
        best_match = matches[0]
        print(f"Pessoa identificada: {best_match['name']} "
              f"(similaridade: {best_match['similarity']:.3f})")
    else:
        print("Pessoa desconhecida")
```

## Performance e Otimização

### Benchmarks Esperados
- **Latência**: 10-15ms por embedding (GPU RTX 3080)
- **Throughput**: ~60-80 fps (single stream)
- **Memória GPU**: ~2GB (modelo + overhead)

### Otimizações
- **Batch Processing**: Configurar REID_BATCH=8 para múltiplas pessoas
- **TensorRT**: Converter ONNX para TensorRT para latência menor
- **FP16**: Usar FORCE_FP16=True (se suportado)

### Monitoramento

```bash
# Verificar uso de GPU
nvidia-smi

# Logs de performance
docker-compose logs reid | grep "Warning.*demorou"

# Métricas de health
curl http://localhost:18090/health | jq
```

## Troubleshooting

### Modelo não carregado
```bash
# Verificar se arquivo existe
ls -la reid-service/models/osnet_x0_75.onnx

# Verificar logs de inicialização
docker-compose logs reid | grep -i "carregando\|erro"

# Testar carregamento manual
python -c "import onnxruntime; print(onnxruntime.get_available_providers())"
```

### GPU não utilizada
```bash
# Verificar providers ONNX
curl http://localhost:18090/health | jq '.providers'

# Deve incluir "CUDAExecutionProvider"
# Se não, verificar NVIDIA Container Toolkit
```

### Inconsistência de cor RGB/BGR
```bash
# Verificar configuração
curl http://localhost:18090/health | jq '.input_format'

# Alterar se necessário
export REID_INPUT_FORMAT=BGR  # ou RGB
docker-compose restart reid
```

### Erro no matching Supabase
```bash
# Verificar configuração
curl http://localhost:18090/health | jq '.supabase_configured'

# Testar RPC diretamente
curl -X POST "https://avbswnnywjyvqfxezgfl.supabase.co/rest/v1/rpc/match_body" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": [0.1, 0.2, ...], "k": 5}'
```

## Testes

```bash
# Executar todos os testes
cd tests
pytest test_reid_service.py -v

# Teste rápido
cd reid-service
python reid_client.py

# Teste manual
python tests/test_reid_service.py
```

## Configuração Docker Compose

```yaml
reid:
  build: ./reid-service
  runtime: nvidia
  environment:
    - NVIDIA_VISIBLE_DEVICES=all
    - SUPABASE_URL=${SUPABASE_URL}
    - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    - REID_MODEL_PATH=/models/osnet_x0_75.onnx
    - REID_INPUT_FORMAT=RGB
  volumes:
    - ./reid-service/models:/models
  ports:
    - "18090:18090"
  restart: unless-stopped
```

## Próximos Passos

1. **Fusion Service**: Integrar Face + Re-ID + YOLO
2. **Tracking**: Adicionar tracking temporal
3. **Calibração**: Ajustar thresholds de similaridade
4. **Metrics**: Implementar métricas de precisão/recall