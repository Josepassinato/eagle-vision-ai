# Face Recognition Service - Visão de Águia

Serviço de reconhecimento facial usando InsightFace-REST (ArcFace) integrado com Supabase.

## Funcionalidades

- Extração de embeddings faciais (512D) usando ArcFace
- Matching facial via RPC do Supabase
- API REST com GPU NVIDIA
- Cliente Python para integração

## Componentes

### 1. InsightFace-REST Service
- **Imagem**: `ghcr.io/deepinsight/insightface:rest`
- **Porta**: 18081
- **Modelos**: RetinaFace (detecção) + ArcFace (embeddings)

### 2. Face Client Python
- `face_client.py`: Cliente principal
- Funções: `embed_face()`, `match_face()`, `add_person_face()`
- Integração direta com Supabase

## Instalação e Execução

### 1. Configurar variáveis de ambiente

```bash
export SUPABASE_URL="https://avbswnnywjyvqfxezgfl.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"
```

### 2. Subir o serviço InsightFace-REST

```bash
cd face-service
docker-compose up -d
```

### 3. Aguardar inicialização (pode demorar 1-2 minutos)

```bash
# Verificar logs
docker-compose logs -f insightface-rest

# Testar quando pronto
curl http://localhost:18081/
```

### 4. Instalar cliente Python

```bash
pip install -r requirements.txt
```

## Uso do Cliente

### Básico

```python
from face_service.face_client import FaceClient

# Inicializar cliente
client = FaceClient()

# Health check
health = client.health_check()
print(health)

# Gerar embedding de uma foto
with open("photo.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

embedding = client.embed_face(img_b64)
print(f"Embedding: {len(embedding)} dimensões")

# Buscar faces similares
matches = client.match_face(img_b64, top_k=5)
for match in matches:
    print(f"Pessoa: {match['name']}, Similaridade: {match['similarity']:.3f}")

# Adicionar nova pessoa
person_id = client.add_person_face("João Silva", img_b64)
print(f"Pessoa adicionada: {person_id}")
```

### Funções Utilitárias

```python
from face_service.face_client import embed_face, match_face

# Gerar embedding diretamente
embedding = embed_face(img_b64)

# Fazer matching diretamente
matches = match_face(img_b64, top_k=3)
```

## API do Cliente

### `FaceClient.embed_face(jpg_b64: str) -> List[float]`

Gera embedding facial de 512 dimensões.

**Parâmetros:**
- `jpg_b64`: Imagem JPEG em base64

**Retorna:**
- Lista de 512 floats

**Exceções:**
- `Exception`: Se não detectar face ou erro de serviço

### `FaceClient.match_face(jpg_b64: str, top_k: int = 5) -> List[Dict]`

Encontra faces similares no banco.

**Parâmetros:**
- `jpg_b64`: Imagem JPEG em base64  
- `top_k`: Número máximo de resultados

**Retorna:**
- Lista de dicionários: `[{"id": str, "name": str, "similarity": float}]`

### `FaceClient.add_person_face(name: str, jpg_b64: str) -> str`

Adiciona nova pessoa com embedding facial.

**Parâmetros:**
- `name`: Nome da pessoa
- `jpg_b64`: Imagem JPEG em base64

**Retorna:**
- ID da pessoa criada

## Testes

```bash
# Executar todos os testes
pytest tests/test_face_client.py -v

# Teste rápido
cd face-service
python face_client.py

# Teste manual
cd tests
python test_face_client.py
```

## Configuração Docker

### docker-compose.yml

- **GPU**: Requer NVIDIA Container Toolkit
- **Modelos**: Baixados automaticamente no primeiro uso
- **Cache**: Volume `./models` para cache de modelos
- **Health Check**: Verifica se serviço está respondendo

### Variáveis de Ambiente do Serviço

- `DET_NAME=retinaface_r50_v1`: Modelo de detecção
- `REC_NAME=arcface_r100_v1`: Modelo de reconhecimento  
- `DET_THRESH=0.6`: Threshold de detecção
- `MAX_SIZE=640,640`: Tamanho máximo da imagem

## Performance

- **Latência**: ~50-100ms por face (GPU)
- **Precisão**: ArcFace R100 (state-of-the-art)
- **Embedding**: 512 dimensões float32
- **Batch**: Suporte a múltiplas faces por imagem

## Troubleshooting

### Serviço não inicia
```bash
# Verificar GPU
nvidia-smi

# Verificar logs
docker-compose logs insightface-rest

# Testar sem GPU (CPU only)
# Remover seção deploy.resources do docker-compose.yml
```

### Erro "Nenhuma face detectada"
- Verificar qualidade da imagem
- Ajustar `DET_THRESH` (default: 0.6)
- Garantir que rosto está visível e bem iluminado

### Conectividade Supabase
```bash
# Verificar variáveis
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Testar conexão
python -c "from face_service.face_client import FaceClient; print(FaceClient().supabase.table('people').select('count').execute())"
```

### Latência alta
- Verificar se está usando GPU
- Reduzir `MAX_SIZE` para imagens menores
- Verificar concorrência de GPU com outros serviços

## Integração com Outros Serviços

O cliente pode ser usado junto com:
- **YOLO Detection**: Recortar faces detectadas
- **Fusion API**: Pipeline completo de reconhecimento
- **MediaMTX**: Processamento de streams ao vivo

Exemplo de integração:
```python
# 1. Detectar pessoa com YOLO
# 2. Recortar face da pessoa
# 3. Gerar embedding facial
# 4. Fazer matching no banco
# 5. Retornar identidade + confiança
```