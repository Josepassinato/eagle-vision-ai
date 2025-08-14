"""
Simplified ByteTrack Tracker para Visão de Águia

Mantém IDs consistentes de objetos através dos frames para cada câmera.
Baseado no algoritmo ByteTrack mas simplificado para detecção de pessoas.
"""

import logging
import time
from collections import defaultdict
from typing import List, Dict, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

# Configurações globais
MAX_DISAPPEARED = 30  # frames sem detecção antes de considerar objeto perdido
IOU_THRESHOLD = 0.3   # threshold de IoU para associação
ASSOCIATION_TIMEOUT = 1.5  # seconds - clear association timeout (1.5-2.0s)


class Track:
    """Representa um objeto sendo rastreado com timeouts temporais claros"""
    def __init__(self, bbox: List[float], track_id: int, frame_count: int):
        self.bbox = bbox  # [x1, y1, x2, y2]
        self.track_id = track_id
        self.confirmed = False
        self.hit_streak = 1  # quantos frames consecutivos foi detectado
        self.time_since_update = 0  # frames desde última atualização
        self.age = 1  # idade total do track
        self.first_frame = frame_count
        self.last_frame = frame_count
        self.last_update_time = time.time()  # timestamp da última atualização
        self.creation_time = time.time()  # timestamp de criação
    
    def update(self, bbox: List[float], frame_count: int):
        """Atualiza o track com nova detecção"""
        self.bbox = bbox
        self.hit_streak += 1
        self.time_since_update = 0
        self.age += 1
        self.last_frame = frame_count
        self.last_update_time = time.time()  # Update temporal timestamp
        
        # Confirma track após 3 detecções consecutivas
        if self.hit_streak >= 3:
            self.confirmed = True
    
    def predict(self):
        """Prediz próximo estado do track (placeholder para implementações futuras)"""
        self.time_since_update += 1
        self.age += 1
    
    def frames_confirmed(self) -> int:
        """Retorna número de frames onde o track foi confirmado"""
        return max(0, self.hit_streak - 2)  # -2 porque precisa de 3 para confirmar
    
    def is_expired(self) -> bool:
        """Verifica se track expirou baseado no timeout temporal"""
        return (time.time() - self.last_update_time) > ASSOCIATION_TIMEOUT
    
    def time_since_last_update(self) -> float:
        """Retorna tempo em segundos desde última atualização"""
        return time.time() - self.last_update_time
    
    def get_center(self) -> Tuple[float, float]:
        """Retorna centro da bounding box"""
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)


def compute_iou(bbox1: List[float], bbox2: List[float]) -> float:
    """
    Calcula Intersection over Union (IoU) entre duas bounding boxes
    
    Args:
        bbox1, bbox2: [x1, y1, x2, y2] em formato xyxy
        
    Returns:
        float: IoU score entre 0 e 1
    """
    x1_1, y1_1, x2_1, y2_1 = bbox1
    x1_2, y1_2, x2_2, y2_2 = bbox2
    
    # Coordenadas da interseção
    x1_inter = max(x1_1, x1_2)
    y1_inter = max(y1_1, y1_2)
    x2_inter = min(x2_1, x2_2)
    y2_inter = min(y2_1, y2_2)
    
    # Área da interseção
    if x2_inter <= x1_inter or y2_inter <= y1_inter:
        inter_area = 0
    else:
        inter_area = (x2_inter - x1_inter) * (y2_inter - y1_inter)
    
    # Áreas das bounding boxes
    area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
    area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
    
    # União
    union_area = area1 + area2 - inter_area
    
    if union_area == 0:
        return 0
    
    return inter_area / union_area


def linear_assignment(cost_matrix: np.ndarray) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
    """
    Realiza assignment linear simples baseado na matriz de custo
    
    Args:
        cost_matrix: Matriz NxM onde cost_matrix[i][j] é o custo de associar track i com detection j
        
    Returns:
        matches: Lista de tuplas (track_idx, detection_idx) para matches
        unmatched_tracks: Lista de índices de tracks não associados  
        unmatched_detections: Lista de índices de detecções não associadas
    """
    if cost_matrix.size == 0:
        return [], list(range(cost_matrix.shape[0])), list(range(cost_matrix.shape[1]))
    
    # Implementação simples usando Hungarian-like greedy approach
    matches = []
    unmatched_tracks = []
    unmatched_detections = list(range(cost_matrix.shape[1]))
    
    for track_idx in range(cost_matrix.shape[0]):
        if len(unmatched_detections) == 0:
            unmatched_tracks.append(track_idx)
            continue
            
        # Encontra detecção com menor custo para este track
        costs = cost_matrix[track_idx, unmatched_detections]
        min_cost_idx = np.argmin(costs)
        min_cost = costs[min_cost_idx]
        
        # Se o custo for muito alto, não faz match
        if min_cost > 0.7:  # threshold baseado em 1-IoU
            unmatched_tracks.append(track_idx)
        else:
            detection_idx = unmatched_detections[min_cost_idx]
            matches.append((track_idx, detection_idx))
            unmatched_detections.remove(detection_idx)
    
    return matches, unmatched_tracks, unmatched_detections


class VisionTracker:
    """
    Multi-camera object tracker
    
    Mantém trackers separados para cada câmera e gerencia IDs únicos
    """
    
    def __init__(self):
        self.trackers_by_camera: Dict[str, Dict[int, Track]] = defaultdict(dict)
        self.next_track_id_by_camera: Dict[str, int] = defaultdict(lambda: 1)
        self.frame_count_by_camera: Dict[str, int] = defaultdict(int)
    
    def update(self, camera_id: str, boxes_xyxy: List[List[float]]) -> List[int]:
        """
        Atualiza tracker com novas detecções para uma câmera específica
        
        Args:
            camera_id: ID único da câmera
            boxes_xyxy: Lista de bounding boxes no formato [x1, y1, x2, y2]
            
        Returns:
            List[int]: Lista de track IDs correspondentes às detecções
        """
        self.frame_count_by_camera[camera_id] += 1
        frame_count = self.frame_count_by_camera[camera_id]
        
        trackers = self.trackers_by_camera[camera_id]
        
        if not boxes_xyxy:
            # Sem detecções - apenas atualiza existing tracks
            for track in trackers.values():
                track.predict()
            
            # Remove tracks expired
            self._cleanup_expired_tracks(camera_id)
            return []
        
        # Calcula matriz de custo (1 - IoU) entre tracks existentes e detecções
        if trackers:
            cost_matrix = np.zeros((len(trackers), len(boxes_xyxy)))
            track_ids = list(trackers.keys())
            
            for i, track_id in enumerate(track_ids):
                track = trackers[track_id]
                for j, detection_bbox in enumerate(boxes_xyxy):
                    iou = compute_iou(track.bbox, detection_bbox)
                    cost_matrix[i, j] = 1 - iou  # Custo = 1 - IoU
        else:
            cost_matrix = np.empty((0, len(boxes_xyxy)))
            track_ids = []
        
        # Realiza assignment
        matches, unmatched_tracks, unmatched_detections = linear_assignment(cost_matrix)
        
        # Atualiza tracks matched
        assigned_track_ids = []
        for track_idx, detection_idx in matches:
            track_id = track_ids[track_idx]
            track = trackers[track_id]
            track.update(boxes_xyxy[detection_idx], frame_count)
            assigned_track_ids.append((detection_idx, track_id))
        
        # Marca tracks não matched como missed
        for track_idx in unmatched_tracks:
            track_id = track_ids[track_idx]
            trackers[track_id].predict()
        
        # Cria novos tracks para detecções não matched
        for detection_idx in unmatched_detections:
            new_track_id = self.next_track_id_by_camera[camera_id]
            self.next_track_id_by_camera[camera_id] += 1
            
            new_track = Track(boxes_xyxy[detection_idx], new_track_id, frame_count)
            trackers[new_track_id] = new_track
            assigned_track_ids.append((detection_idx, new_track_id))
            
            logger.debug(f"Novo track {new_track_id} criado na camera {camera_id}")
        
        # Remover tracks antigos (baseado em timeout temporal)
        self._cleanup_expired_tracks(camera_id)
        
        # Retorna track IDs na ordem das detecções originais
        result_track_ids = [0] * len(boxes_xyxy)
        for detection_idx, track_id in assigned_track_ids:
            result_track_ids[detection_idx] = track_id
        
        return result_track_ids
    
    def _cleanup_expired_tracks(self, camera_id: str):
        """Remove tracks expirados baseado em timeout temporal"""
        trackers = self.trackers_by_camera[camera_id]
        tracks_to_remove = []
        current_time = time.time()
        
        for track_id, track in trackers.items():
            # Check both frame-based and time-based expiration
            is_frame_expired = track.time_since_update > MAX_DISAPPEARED
            is_time_expired = track.is_expired()
            
            if is_frame_expired or is_time_expired:
                tracks_to_remove.append(track_id)
        
        for track_id in tracks_to_remove:
            track = trackers[track_id]
            time_inactive = current_time - track.last_update_time
            logger.debug(f"Removendo track {track_id} da camera {camera_id} (inativo por {time_inactive:.2f}s, {track.time_since_update} frames)")
            del trackers[track_id]
    
    def frames_confirmed(self, camera_id: str, track_id: int) -> int:
        """
        Retorna número de frames consecutivos que um track foi confirmado
        
        Args:
            camera_id: ID da câmera
            track_id: ID do track
            
        Returns:
            int: Número de frames confirmados (0 se track não existe)
        """
        trackers = self.trackers_by_camera[camera_id]
        if track_id not in trackers:
            return 0
        return trackers[track_id].frames_confirmed()
    
    def reset(self, camera_id: str) -> None:
        """
        Reseta todos os tracks de uma câmera específica
        
        Args:
            camera_id: ID da câmera para resetar
        """
        self.trackers_by_camera[camera_id].clear()
        self.next_track_id_by_camera[camera_id] = 1
        self.frame_count_by_camera[camera_id] = 0
        logger.info(f"Tracker resetado para camera {camera_id}")
    
    def get_track_info(self, camera_id: str, track_id: int) -> Optional[Dict]:
        """Retorna informações detalhadas de um track"""
        trackers = self.trackers_by_camera[camera_id]
        
        if track_id not in trackers:
            return None
        
        track = trackers[track_id]
        cx, cy = track.get_center()
        
        return {
            "track_id": track_id,
            "bbox": track.bbox,
            "center": [cx, cy],
            "confirmed": track.confirmed,
            "frames_confirmed": track.frames_confirmed(),
            "hit_streak": track.hit_streak,
            "age": track.age,
            "time_since_update": track.time_since_update,
            "last_update_time": track.last_update_time,
            "time_since_last_update": track.time_since_last_update(),
            "is_expired": track.is_expired()
        }
    
    def get_all_tracks(self, camera_id: str) -> List[Dict]:
        """Retorna informações de todos os tracks ativos de uma câmera"""
        trackers = self.trackers_by_camera[camera_id]
        
        tracks_info = []
        for track_id in trackers:
            info = self.get_track_info(camera_id, track_id)
            if info:
                tracks_info.append(info)
        
        return tracks_info

# Instância global do tracker
_global_tracker = VisionTracker()

# Funções de conveniência para usar o tracker global
def update(camera_id: str, boxes_xyxy: List[List[float]]) -> List[int]:
    """Função de conveniência para usar tracker global"""
    return _global_tracker.update(camera_id, boxes_xyxy)

def frames_confirmed(camera_id: str, track_id: int) -> int:
    """Função de conveniência para usar tracker global"""
    return _global_tracker.frames_confirmed(camera_id, track_id)

def reset(camera_id: str) -> None:
    """Função de conveniência para usar tracker global"""
    _global_tracker.reset(camera_id)