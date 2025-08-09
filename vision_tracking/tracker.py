#!/usr/bin/env python3
"""
Tracker de objetos usando ByteTrack - Visão de Águia
Mantém IDs consistentes entre frames por câmera
"""

import os
import logging
import time
from typing import List, Dict, Tuple, Optional
from collections import defaultdict, deque
import numpy as np

# Configuração
TRACK_MIN_FRAMES = int(os.getenv("TRACK_MIN_FRAMES", "15"))
TRACK_MAX_AGE = int(os.getenv("TRACK_MAX_AGE", "30"))
TRACK_MIN_HITS = int(os.getenv("TRACK_MIN_HITS", "3"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.3"))

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Track:
    """Classe para representar um track individual"""
    
    def __init__(self, track_id: int, bbox: List[float], frame_count: int = 0):
        self.track_id = track_id
        self.bbox = bbox  # [x1, y1, x2, y2]
        self.frame_count = frame_count
        self.age = 0
        self.hit_streak = 0
        self.time_since_update = 0
        self.confirmed = False
        self.history = deque(maxlen=50)  # Histórico de bboxes
        
        # Adicionar primeiro bbox ao histórico
        self.history.append((frame_count, bbox.copy()))
    
    def update(self, bbox: List[float], frame_count: int):
        """Atualiza o track com nova detecção"""
        self.bbox = bbox
        self.frame_count = frame_count
        self.hit_streak += 1
        self.time_since_update = 0
        self.age += 1
        
        # Confirmar track se atingiu mínimo de hits
        if self.hit_streak >= TRACK_MIN_HITS:
            self.confirmed = True
        
        # Adicionar ao histórico
        self.history.append((frame_count, bbox.copy()))
        
        logger.debug(f"Track {self.track_id} updated: hits={self.hit_streak}, confirmed={self.confirmed}")
    
    def predict(self):
        """Prediz próxima posição (implementação simples)"""
        self.age += 1
        self.time_since_update += 1
        
        # Para ByteTrack simples, mantemos posição atual
        # Em implementação completa, usaria filtro de Kalman
        return self.bbox
    
    def get_center(self) -> Tuple[float, float]:
        """Retorna centro do bbox"""
        x1, y1, x2, y2 = self.bbox
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2
        return cx, cy
    
    def frames_confirmed(self) -> int:
        """Retorna número de frames confirmados consecutivos"""
        if not self.confirmed:
            return 0
        return max(0, self.hit_streak - TRACK_MIN_HITS + 1)

def compute_iou(bbox1: List[float], bbox2: List[float]) -> float:
    """Calcula IoU entre duas bboxes"""
    x1_1, y1_1, x2_1, y2_1 = bbox1
    x1_2, y1_2, x2_2, y2_2 = bbox2
    
    # Coordenadas da interseção
    x1_i = max(x1_1, x1_2)
    y1_i = max(y1_1, y1_2)
    x2_i = min(x2_1, x2_2)
    y2_i = min(y2_1, y2_2)
    
    # Área da interseção
    if x2_i <= x1_i or y2_i <= y1_i:
        intersection = 0
    else:
        intersection = (x2_i - x1_i) * (y2_i - y1_i)
    
    # Áreas das bboxes
    area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
    area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
    
    # União
    union = area1 + area2 - intersection
    
    if union == 0:
        return 0
    
    return intersection / union

def linear_assignment(cost_matrix: np.ndarray) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
    """Implementação simples de atribuição linear (substituição do scipy)"""
    if cost_matrix.size == 0:
        return [], list(range(cost_matrix.shape[0])), list(range(cost_matrix.shape[1]))
    
    # Algoritmo húngaro simplificado (greedy)
    matches = []
    unmatched_tracks = list(range(cost_matrix.shape[0]))
    unmatched_detections = list(range(cost_matrix.shape[1]))
    
    # Para cada track, encontrar melhor detecção
    for track_idx in range(cost_matrix.shape[0]):
        if len(unmatched_detections) == 0:
            break
            
        # Encontrar detecção com menor custo
        costs = cost_matrix[track_idx, unmatched_detections]
        if len(costs) == 0:
            continue
            
        min_cost_idx = np.argmin(costs)
        min_cost = costs[min_cost_idx]
        det_idx = unmatched_detections[min_cost_idx]
        
        # Se custo é aceitável, fazer match
        if min_cost < (1 - IOU_THRESHOLD):  # Converter IoU para custo
            matches.append((track_idx, det_idx))
            unmatched_tracks.remove(track_idx)
            unmatched_detections.remove(det_idx)
    
    return matches, unmatched_tracks, unmatched_detections

class VisionTracker:
    """Tracker principal usando algoritmo ByteTrack simplificado"""
    
    def __init__(self):
        self.trackers_by_camera: Dict[str, Dict[int, Track]] = defaultdict(dict)
        self.next_id_by_camera: Dict[str, int] = defaultdict(lambda: 1)
        self.frame_count_by_camera: Dict[str, int] = defaultdict(int)
        
        logger.info(f"VisionTracker inicializado - min_frames={TRACK_MIN_FRAMES}, max_age={TRACK_MAX_AGE}")
    
    def update(self, camera_id: str, boxes_xyxy: List[List[float]]) -> List[int]:
        """
        Atualiza tracker com novas detecções
        
        Args:
            camera_id: ID da câmera
            boxes_xyxy: Lista de bboxes [[x1,y1,x2,y2], ...]
            
        Returns:
            Lista de track_ids correspondendo às boxes na mesma ordem
        """
        self.frame_count_by_camera[camera_id] += 1
        frame_count = self.frame_count_by_camera[camera_id]
        
        trackers = self.trackers_by_camera[camera_id]
        
        logger.debug(f"Camera {camera_id} frame {frame_count}: {len(boxes_xyxy)} detections, {len(trackers)} trackers")
        
        # Predizer posições dos tracks existentes
        for track in trackers.values():
            track.predict()
        
        # Se não há detecções, apenas envelhece tracks
        if len(boxes_xyxy) == 0:
            # Remover tracks muito antigos
            to_remove = []
            for track_id, track in trackers.items():
                if track.time_since_update > TRACK_MAX_AGE:
                    to_remove.append(track_id)
            
            for track_id in to_remove:
                del trackers[track_id]
                logger.debug(f"Track {track_id} removido por idade")
            
            return []
        
        # Se não há tracks, criar novos para todas as detecções
        if len(trackers) == 0:
            track_ids = []
            for bbox in boxes_xyxy:
                track_id = self.next_id_by_camera[camera_id]
                self.next_id_by_camera[camera_id] += 1
                
                track = Track(track_id, bbox, frame_count)
                trackers[track_id] = track
                track_ids.append(track_id)
                
                logger.debug(f"Novo track {track_id} criado")
            
            return track_ids
        
        # Calcular matriz de custo (IoU)
        track_list = list(trackers.values())
        cost_matrix = np.zeros((len(track_list), len(boxes_xyxy)))
        
        for i, track in enumerate(track_list):
            for j, bbox in enumerate(boxes_xyxy):
                iou = compute_iou(track.bbox, bbox)
                cost_matrix[i, j] = 1 - iou  # Converter para custo
        
        # Atribuição linear (matching)
        matches, unmatched_tracks, unmatched_detections = linear_assignment(cost_matrix)
        
        # Processar matches
        result_track_ids = [0] * len(boxes_xyxy)
        
        for track_idx, det_idx in matches:
            track = track_list[track_idx]
            track.update(boxes_xyxy[det_idx], frame_count)
            result_track_ids[det_idx] = track.track_id
        
        # Criar novos tracks para detecções não atribuídas
        for det_idx in unmatched_detections:
            track_id = self.next_id_by_camera[camera_id]
            self.next_id_by_camera[camera_id] += 1
            
            track = Track(track_id, boxes_xyxy[det_idx], frame_count)
            trackers[track_id] = track
            result_track_ids[det_idx] = track_id
            
            logger.debug(f"Novo track {track_id} criado para detecção não atribuída")
        
        # Remover tracks não atribuídos há muito tempo
        to_remove = []
        for track_idx in unmatched_tracks:
            track = track_list[track_idx]
            if track.time_since_update > TRACK_MAX_AGE:
                to_remove.append(track.track_id)
        
        for track_id in to_remove:
            del trackers[track_id]
            logger.debug(f"Track {track_id} removido por falta de matches")
        
        # Log estatísticas
        confirmed_tracks = sum(1 for t in trackers.values() if t.confirmed)
        logger.info(f"Camera {camera_id}: {len(trackers)} tracks ativos, {confirmed_tracks} confirmados")
        
        return result_track_ids
    
    def frames_confirmed(self, camera_id: str, track_id: int) -> int:
        """
        Retorna número de frames consecutivos confirmados para um track
        
        Args:
            camera_id: ID da câmera
            track_id: ID do track
            
        Returns:
            Número de frames confirmados consecutivos
        """
        trackers = self.trackers_by_camera[camera_id]
        
        if track_id not in trackers:
            return 0
        
        return trackers[track_id].frames_confirmed()
    
    def reset(self, camera_id: str) -> None:
        """
        Reseta tracker para uma câmera específica
        
        Args:
            camera_id: ID da câmera para resetar
        """
        if camera_id in self.trackers_by_camera:
            del self.trackers_by_camera[camera_id]
        
        self.next_id_by_camera[camera_id] = 1
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
            "time_since_update": track.time_since_update
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