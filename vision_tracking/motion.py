#!/usr/bin/env python3
"""
Análise de movimento de objetos trackados - Visão de Águia
Calcula deslocamento em pixels para detecção de movimento
"""

import os
import logging
import math
from typing import List, Dict, Tuple
from collections import defaultdict, deque
import numpy as np

# Configuração
MOTION_WINDOW = int(os.getenv("MOTION_WINDOW", "15"))
MIN_DISPLACEMENT_THRESHOLD = float(os.getenv("MIN_DISPLACEMENT_THRESHOLD", "0.5"))

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrackMotion:
    """Classe para analisar movimento de um track específico"""
    
    def __init__(self, track_id: int, motion_window: int = MOTION_WINDOW):
        self.track_id = track_id
        self.motion_window = motion_window
        self.positions = deque(maxlen=motion_window)  # Histórico de posições (cx, cy)
        self.displacements = deque(maxlen=motion_window - 1)  # Histórico de deslocamentos
        self.total_displacement = 0.0
        self.frame_count = 0
    
    def update(self, bbox: List[float]) -> float:
        """
        Atualiza posição e calcula deslocamento
        
        Args:
            bbox: [x1, y1, x2, y2]
            
        Returns:
            Deslocamento desde última posição
        """
        # Calcular centro
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2
        
        current_pos = (cx, cy)
        displacement = 0.0
        
        # Calcular deslocamento se há posição anterior
        if len(self.positions) > 0:
            prev_cx, prev_cy = self.positions[-1]
            displacement = math.sqrt((cx - prev_cx)**2 + (cy - prev_cy)**2)
            self.displacements.append(displacement)
            self.total_displacement += displacement
        
        # Adicionar posição atual
        self.positions.append(current_pos)
        self.frame_count += 1
        
        logger.debug(f"Track {self.track_id}: pos=({cx:.1f},{cy:.1f}), displacement={displacement:.2f}")
        
        return displacement
    
    def get_median_displacement(self) -> float:
        """Retorna mediana dos deslocamentos na janela"""
        if len(self.displacements) == 0:
            return 0.0
        
        return float(np.median(list(self.displacements)))
    
    def get_mean_displacement(self) -> float:
        """Retorna média dos deslocamentos na janela"""
        if len(self.displacements) == 0:
            return 0.0
        
        return float(np.mean(list(self.displacements)))
    
    def get_total_displacement(self) -> float:
        """Retorna deslocamento total acumulado"""
        return self.total_displacement
    
    def get_displacement_variance(self) -> float:
        """Retorna variância dos deslocamentos (indicador de movimento errático)"""
        if len(self.displacements) < 2:
            return 0.0
        
        return float(np.var(list(self.displacements)))
    
    def is_moving(self, threshold: float = MIN_DISPLACEMENT_THRESHOLD) -> bool:
        """Determina se o objeto está em movimento"""
        median_disp = self.get_median_displacement()
        return median_disp > threshold
    
    def get_motion_stats(self) -> Dict:
        """Retorna estatísticas completas de movimento"""
        return {
            "track_id": self.track_id,
            "frame_count": self.frame_count,
            "positions_count": len(self.positions),
            "displacements_count": len(self.displacements),
            "median_displacement": self.get_median_displacement(),
            "mean_displacement": self.get_mean_displacement(),
            "total_displacement": self.get_total_displacement(),
            "displacement_variance": self.get_displacement_variance(),
            "is_moving": self.is_moving(),
            "current_position": self.positions[-1] if self.positions else None
        }

class MotionAnalyzer:
    """Analisador de movimento para múltiplas câmeras e tracks"""
    
    def __init__(self, motion_window: int = MOTION_WINDOW):
        self.motion_window = motion_window
        self.track_motions_by_camera: Dict[str, Dict[int, TrackMotion]] = defaultdict(dict)
        
        logger.info(f"MotionAnalyzer inicializado - window={motion_window}")
    
    def update_and_displacement(self, camera_id: str, track_id: int, box_xyxy: List[float]) -> float:
        """
        Atualiza movimento e retorna deslocamento mediano
        
        Args:
            camera_id: ID da câmera
            track_id: ID do track
            box_xyxy: [x1, y1, x2, y2]
            
        Returns:
            Mediana do deslocamento em pixels nos últimos N frames
        """
        track_motions = self.track_motions_by_camera[camera_id]
        
        # Criar TrackMotion se não existir
        if track_id not in track_motions:
            track_motions[track_id] = TrackMotion(track_id, self.motion_window)
            logger.debug(f"TrackMotion criado para camera {camera_id}, track {track_id}")
        
        # Atualizar movimento
        track_motion = track_motions[track_id]
        current_displacement = track_motion.update(box_xyxy)
        
        # Retornar mediana dos deslocamentos
        median_displacement = track_motion.get_median_displacement()
        
        # Log periódico de estatísticas
        if track_motion.frame_count % 30 == 0:  # A cada 30 frames
            stats = track_motion.get_motion_stats()
            logger.info(f"Camera {camera_id}, Track {track_id}: {stats}")
        
        return median_displacement
    
    def get_track_motion_stats(self, camera_id: str, track_id: int) -> Dict:
        """Retorna estatísticas de movimento de um track específico"""
        track_motions = self.track_motions_by_camera[camera_id]
        
        if track_id not in track_motions:
            return {
                "track_id": track_id,
                "exists": False,
                "error": "Track não encontrado"
            }
        
        stats = track_motions[track_id].get_motion_stats()
        stats["exists"] = True
        stats["camera_id"] = camera_id
        
        return stats
    
    def get_moving_tracks(self, camera_id: str, threshold: float = MIN_DISPLACEMENT_THRESHOLD) -> List[int]:
        """Retorna IDs dos tracks que estão se movendo"""
        track_motions = self.track_motions_by_camera[camera_id]
        
        moving_tracks = []
        for track_id, track_motion in track_motions.items():
            if track_motion.is_moving(threshold):
                moving_tracks.append(track_id)
        
        return moving_tracks
    
    def get_all_motion_stats(self, camera_id: str) -> List[Dict]:
        """Retorna estatísticas de movimento de todos os tracks ativos"""
        track_motions = self.track_motions_by_camera[camera_id]
        
        all_stats = []
        for track_id, track_motion in track_motions.items():
            stats = track_motion.get_motion_stats()
            stats["camera_id"] = camera_id
            all_stats.append(stats)
        
        return all_stats
    
    def cleanup_old_tracks(self, camera_id: str, active_track_ids: List[int]) -> None:
        """Remove tracks que não estão mais ativos"""
        track_motions = self.track_motions_by_camera[camera_id]
        
        # Encontrar tracks para remover
        to_remove = []
        for track_id in track_motions:
            if track_id not in active_track_ids:
                to_remove.append(track_id)
        
        # Remover tracks inativos
        for track_id in to_remove:
            del track_motions[track_id]
            logger.debug(f"TrackMotion removido para track {track_id}")
    
    def reset(self, camera_id: str) -> None:
        """Reseta análise de movimento para uma câmera"""
        if camera_id in self.track_motions_by_camera:
            del self.track_motions_by_camera[camera_id]
        
        logger.info(f"MotionAnalyzer resetado para camera {camera_id}")

# Instância global do analisador de movimento
_global_motion_analyzer = MotionAnalyzer()

# Funções de conveniência
def update_and_displacement(camera_id: str, track_id: int, box_xyxy: List[float]) -> float:
    """Função de conveniência para usar analisador global"""
    return _global_motion_analyzer.update_and_displacement(camera_id, track_id, box_xyxy)

def get_track_motion_stats(camera_id: str, track_id: int) -> Dict:
    """Função de conveniência para estatísticas de um track"""
    return _global_motion_analyzer.get_track_motion_stats(camera_id, track_id)

def get_moving_tracks(camera_id: str, threshold: float = MIN_DISPLACEMENT_THRESHOLD) -> List[int]:
    """Função de conveniência para tracks em movimento"""
    return _global_motion_analyzer.get_moving_tracks(camera_id, threshold)

def reset_motion(camera_id: str) -> None:
    """Função de conveniência para resetar movimento"""
    _global_motion_analyzer.reset(camera_id)