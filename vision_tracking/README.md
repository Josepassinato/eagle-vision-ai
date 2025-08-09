# Vision Tracking Module - Visão de Águia

Módulo de tracking de objetos e análise de movimento para pipeline de visão computacional. Implementa ByteTrack simplificado e análise de deslocamento em pixels.

## Funcionalidades

### Tracker (ByteTrack)
- Mantém IDs consistentes entre frames por câmera
- Algoritmo de atribuição baseado em IoU
- Confirmação de tracks após N hits consecutivos
- Remoção automática de tracks inativos

### Motion Analyzer  
- Calcula deslocamento em pixels entre frames
- Mediana de movimento em janela deslizante
- Detecção de objetos em movimento vs estáticos
- Estatísticas completas de movimento

## Arquitetura

### Classes Principais

#### `VisionTracker`
- **Algoritmo**: ByteTrack simplificado (sem Kalman Filter)
- **Atribuição**: Hungarian algorithm approximation
- **Persistência**: Tracks por câmera com aging automático

#### `MotionAnalyzer`
- **Medição**: Distância euclidiana entre centros de bbox
- **Janela**: Histórico deslizante configurável
- **Estatísticas**: Mediana, média, variância, total

## Instalação e Uso

### 1. Instalar dependências

```bash
cd vision_tracking
pip install -r requirements.txt
```

### 2. Configurar variáveis de ambiente

```bash
export TRACK_MIN_FRAMES=15      # Frames mínimos para confirmação
export TRACK_MAX_AGE=30         # Frames máximos sem detecção
export TRACK_MIN_HITS=3         # Hits mínimos para confirmar track
export IOU_THRESHOLD=0.3        # Threshold IoU para matching
export MOTION_WINDOW=15         # Janela para análise de movimento
export MIN_DISPLACEMENT_THRESHOLD=0.5  # Threshold para movimento
```

## API Principal

### Tracker

```python
from vision_tracking import VisionTracker

tracker = VisionTracker()

# Atualizar com detecções
boxes = [[x1, y1, x2, y2], ...]  # Bboxes do YOLO
track_ids = tracker.update("camera_01", boxes)

# Verificar frames confirmados
confirmed = tracker.frames_confirmed("camera_01", track_id)

# Reset (nova sequência/reinicialização)
tracker.reset("camera_01")
```

### Motion Analyzer

```python
from vision_tracking import MotionAnalyzer

motion = MotionAnalyzer()

# Atualizar movimento e obter deslocamento
displacement = motion.update_and_displacement("camera_01", track_id, [x1, y1, x2, y2])

# Estatísticas de movimento
stats = motion.get_track_motion_stats("camera_01", track_id)

# Tracks em movimento
moving_tracks = motion.get_moving_tracks("camera_01")
```

### Funções de Conveniência (Globais)

```python
from vision_tracking.tracker import update, frames_confirmed, reset
from vision_tracking.motion import update_and_displacement

# Usar instâncias globais
track_ids = update("camera_01", boxes)
displacement = update_and_displacement("camera_01", track_id, bbox)
```

## Exemplo de Integração Completa

```python
from vision_tracking import VisionTracker, MotionAnalyzer

# Inicializar
tracker = VisionTracker()
motion = MotionAnalyzer()

camera_id = "cam_01"

# Para cada frame do vídeo
for frame_num, detections in enumerate(video_frames):
    # 1. Extrair bboxes das detecções YOLO
    boxes = [det["bbox"] for det in detections]  # [[x1,y1,x2,y2], ...]
    
    # 2. Atualizar tracker
    track_ids = tracker.update(camera_id, boxes)
    
    # 3. Para cada track ativo
    for i, track_id in enumerate(track_ids):
        bbox = boxes[i]
        
        # 4. Analisar movimento
        displacement = motion.update_and_displacement(camera_id, track_id, bbox)
        
        # 5. Verificar estabilidade
        frames_conf = tracker.frames_confirmed(camera_id, track_id)
        
        # 6. Logs estruturados
        print(f"Frame {frame_num}: Track {track_id}, "
              f"confirmed={frames_conf}, displacement={displacement:.2f}px")
        
        # 7. Critério para Fusion API
        if frames_conf >= 15 and displacement > 2.0:
            print(f"Track {track_id} pronto para identificação!")
            # Chamar Face/Re-ID...

# Limpeza periódica de tracks inativos
active_tracks = [info["track_id"] for info in tracker.get_all_tracks(camera_id)]
motion.cleanup_old_tracks(camera_id, active_tracks)
```

## Critérios de Aceite

### ✅ Rastros Estáveis (≥ 15 frames)

```python
# Simular sequência longa
boxes = [[100, 100, 200, 300]] * 20  # Mesmo objeto por 20 frames

track_ids = []
for i, bbox in enumerate(boxes):
    ids = tracker.update("test_cam", [bbox])
    track_ids.append(ids[0])
    
    frames_conf = tracker.frames_confirmed("test_cam", ids[0])
    print(f"Frame {i}: ID={ids[0]}, confirmed={frames_conf}")

# Resultado esperado:
# Frame 0: ID=1, confirmed=0
# Frame 1: ID=1, confirmed=0  
# Frame 2: ID=1, confirmed=0
# Frame 3: ID=1, confirmed=1  # Confirmado após TRACK_MIN_HITS
# Frame 4: ID=1, confirmed=2
# ...
# Frame 19: ID=1, confirmed=17
```

### ✅ Displacement Responde a Movimento

```python
# Movimento constante horizontal
for frame in range(10):
    x_offset = frame * 10  # 10px por frame
    bbox = [100 + x_offset, 100, 200 + x_offset, 300]
    
    displacement = motion.update_and_displacement("test_cam", 1, bbox)
    print(f"Frame {frame}: displacement={displacement:.1f}px")

# Resultado esperado:
# Frame 0: displacement=0.0px    # Primeiro frame
# Frame 1: displacement=10.0px   # Movimento detectado
# Frame 2: displacement=10.0px   # Movimento constante
# ...
```

### ✅ IDs Persistem com Variações

```python
# Pequenas variações do mesmo objeto
variations = [
    [100, 100, 200, 300],  # Original
    [102, 98, 198, 305],   # Pequeno movimento
    [105, 95, 205, 298],   # Outro movimento
    [103, 102, 197, 303],  # Volta próximo
]

original_id = None
for i, bbox in enumerate(variations):
    track_ids = tracker.update("test_cam", [bbox])
    
    if original_id is None:
        original_id = track_ids[0]
    
    assert track_ids[0] == original_id, f"ID mudou: {track_ids[0]} != {original_id}"
    print(f"Frame {i}: ID={track_ids[0]} (consistente)")
```

## Performance

### Benchmarks Típicos
- **Latência**: ~1-2ms por frame (CPU)
- **Memória**: ~100MB para 100 tracks ativos
- **Throughput**: >500 fps (tracking puro)

### Otimizações
- Tracking puramente CPU (sem GPU)
- Algoritmo húngaro simplificado  
- Janelas deslizantes com deque
- Cleanup automático de tracks inativos

## Configuração Avançada

### Tuning de Performance

```python
# Para câmeras com muitos objetos
export TRACK_MAX_AGE=10         # Cleanup mais agressivo
export IOU_THRESHOLD=0.5        # Matching mais restritivo

# Para objetos que se movem devagar
export MOTION_WINDOW=30         # Janela maior
export MIN_DISPLACEMENT_THRESHOLD=0.1  # Sensibilidade maior
```

### Logging Estruturado

```python
import logging

# Configurar logs detalhados
logging.getLogger('vision_tracking.tracker').setLevel(logging.DEBUG)
logging.getLogger('vision_tracking.motion').setLevel(logging.INFO)

# Logs incluem:
# - camera_id, track_id
# - frames_confirmed, displacement  
# - bbox coordinates
# - matching statistics
```

## Troubleshooting

### IDs mudam constantemente
- Reduzir `IOU_THRESHOLD` (ex: 0.2)
- Aumentar `TRACK_MAX_AGE`
- Verificar qualidade das detecções YOLO

### Movimento não detectado
- Reduzir `MIN_DISPLACEMENT_THRESHOLD`
- Aumentar `MOTION_WINDOW` 
- Verificar resolução da câmera

### Performance lenta
- Verificar número de tracks ativos
- Implementar cleanup periódico
- Reduzir `MOTION_WINDOW`

### Memória crescendo
- Verificar cleanup de tracks
- Reduzir `TRACK_MAX_AGE`
- Implementar reset periódico

## Testes

```bash
# Executar todos os testes
pytest tests/test_tracking_motion.py -v

# Teste específico  
python tests/test_tracking_motion.py

# Teste de performance
python -m vision_tracking.performance_test
```

## Próximos Passos

1. **Fusion API**: Integrar tracking com Face/Re-ID
2. **Kalman Filter**: Melhorar predição de movimento  
3. **Re-ID Integration**: Usar embeddings para associação
4. **Multi-camera**: Tracking entre câmeras
5. **Metrics**: ROI, MOTA, IDF1 para avaliação