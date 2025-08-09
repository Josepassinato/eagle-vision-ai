#!/usr/bin/env python3
"""
Testes para o módulo de tracking e movimento
"""

import os
import sys
import pytest
import math
from typing import List

# Adicionar diretório pai ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vision_tracking.tracker import VisionTracker, update, frames_confirmed, reset
from vision_tracking.motion import MotionAnalyzer, update_and_displacement, get_track_motion_stats

class TestVisionTracker:
    """Testes para o tracker ByteTrack"""
    
    def setup_method(self):
        """Setup para cada teste"""
        self.tracker = VisionTracker()
        self.camera_id = "test_cam"
    
    def test_single_detection_tracking(self):
        """Testa tracking de uma única detecção"""
        # Primeira detecção
        boxes = [[100, 100, 200, 300]]  # [x1, y1, x2, y2]
        track_ids = self.tracker.update(self.camera_id, boxes)
        
        assert len(track_ids) == 1
        assert track_ids[0] > 0  # ID válido
        
        # Confirmar que frames_confirmed começa em 0
        confirmed = self.tracker.frames_confirmed(self.camera_id, track_ids[0])
        assert confirmed == 0  # Ainda não confirmado
    
    def test_persistent_tracking(self):
        """Testa persistência de ID com pequenas variações"""
        boxes = [[100, 100, 200, 300]]
        
        # Primeira detecção
        track_ids_1 = self.tracker.update(self.camera_id, boxes)
        original_id = track_ids_1[0]
        
        # Pequenas variações da mesma detecção
        variations = [
            [[102, 98, 198, 305]],    # Pequeno movimento
            [[105, 95, 205, 298]],    # Outro pequeno movimento
            [[103, 102, 197, 303]],   # Volta próximo ao original
        ]
        
        for i, variant_boxes in enumerate(variations):
            track_ids = self.tracker.update(self.camera_id, variant_boxes)
            assert len(track_ids) == 1
            assert track_ids[0] == original_id, f"ID mudou no frame {i+2}: {track_ids[0]} != {original_id}"
    
    def test_frames_confirmed_growth(self):
        """Testa crescimento de frames_confirmed"""
        boxes = [[100, 100, 200, 300]]
        
        # Atualizar múltiplas vezes
        track_ids = None
        for frame in range(20):
            track_ids = self.tracker.update(self.camera_id, boxes)
            
            if frame >= 3:  # Após TRACK_MIN_HITS frames
                confirmed = self.tracker.frames_confirmed(self.camera_id, track_ids[0])
                expected_confirmed = frame - 2  # frames após confirmação
                assert confirmed == expected_confirmed, f"Frame {frame}: confirmed={confirmed}, expected={expected_confirmed}"
    
    def test_multiple_objects_tracking(self):
        """Testa tracking de múltiplos objetos"""
        # Duas detecções bem separadas
        boxes = [
            [50, 50, 150, 250],    # Objeto 1
            [300, 100, 400, 300]   # Objeto 2
        ]
        
        # Primeira detecção
        track_ids_1 = self.tracker.update(self.camera_id, boxes)
        assert len(track_ids_1) == 2
        assert track_ids_1[0] != track_ids_1[1]  # IDs diferentes
        
        # Mover objetos ligeiramente
        moved_boxes = [
            [52, 52, 152, 252],    # Objeto 1 movido
            [302, 102, 402, 302]   # Objeto 2 movido
        ]
        
        track_ids_2 = self.tracker.update(self.camera_id, moved_boxes)
        assert len(track_ids_2) == 2
        
        # IDs devem ser preservados (ordem pode variar dependendo do matching)
        assert set(track_ids_1) == set(track_ids_2)
    
    def test_object_disappearance(self):
        """Testa comportamento quando objeto desaparece"""
        boxes = [[100, 100, 200, 300]]
        
        # Criar track
        track_ids = self.tracker.update(self.camera_id, boxes)
        original_id = track_ids[0]
        
        # Objeto desaparece por alguns frames
        for _ in range(5):
            empty_track_ids = self.tracker.update(self.camera_id, [])
            assert len(empty_track_ids) == 0
        
        # Objeto reaparece
        reappear_track_ids = self.tracker.update(self.camera_id, boxes)
        # Pode ou não ser o mesmo ID dependendo de TRACK_MAX_AGE
        assert len(reappear_track_ids) == 1
    
    def test_reset_functionality(self):
        """Testa função de reset"""
        boxes = [[100, 100, 200, 300]]
        
        # Criar alguns tracks
        track_ids = self.tracker.update(self.camera_id, boxes)
        assert len(track_ids) == 1
        
        # Reset
        self.tracker.reset(self.camera_id)
        
        # Próxima detecção deve começar com ID 1 novamente
        new_track_ids = self.tracker.update(self.camera_id, boxes)
        assert len(new_track_ids) == 1
        assert new_track_ids[0] == 1

class TestMotionAnalyzer:
    """Testes para análise de movimento"""
    
    def setup_method(self):
        """Setup para cada teste"""
        self.motion_analyzer = MotionAnalyzer(motion_window=5)  # Janela pequena para testes
        self.camera_id = "test_cam"
        self.track_id = 1
    
    def test_stationary_object(self):
        """Testa objeto parado"""
        # Mesma posição por vários frames
        bbox = [100, 100, 200, 300]
        
        displacements = []
        for _ in range(10):
            displacement = self.motion_analyzer.update_and_displacement(
                self.camera_id, self.track_id, bbox
            )
            displacements.append(displacement)
        
        # Primeiro displacement é 0 (sem posição anterior)
        assert displacements[0] == 0.0
        
        # Outros displacements devem ser próximos de 0
        for i in range(1, len(displacements)):
            assert displacements[i] == 0.0, f"Frame {i}: displacement={displacements[i]}, esperado=0"
    
    def test_constant_movement(self):
        """Testa objeto com movimento constante"""
        # Movimento constante horizontal (10 pixels por frame)
        movement_per_frame = 10
        
        displacements = []
        for frame in range(10):
            x_offset = frame * movement_per_frame
            bbox = [100 + x_offset, 100, 200 + x_offset, 300]
            
            displacement = self.motion_analyzer.update_and_displacement(
                self.camera_id, self.track_id, bbox
            )
            displacements.append(displacement)
        
        # Primeiro displacement é 0
        assert displacements[0] == 0.0
        
        # Outros displacements devem ser próximos do movimento esperado
        for i in range(1, len(displacements)):
            assert abs(displacements[i] - movement_per_frame) < 0.1, \
                f"Frame {i}: displacement={displacements[i]}, esperado={movement_per_frame}"
    
    def test_diagonal_movement(self):
        """Testa movimento diagonal"""
        # Movimento diagonal (3-4-5 triangle)
        dx, dy = 3, 4
        expected_displacement = 5  # sqrt(3^2 + 4^2)
        
        displacements = []
        for frame in range(6):
            x_offset = frame * dx
            y_offset = frame * dy
            bbox = [100 + x_offset, 100 + y_offset, 200 + x_offset, 300 + y_offset]
            
            displacement = self.motion_analyzer.update_and_displacement(
                self.camera_id, self.track_id, bbox
            )
            displacements.append(displacement)
        
        # Verificar displacements (exceto primeiro que é 0)
        for i in range(1, len(displacements)):
            assert abs(displacements[i] - expected_displacement) < 0.1, \
                f"Frame {i}: displacement={displacements[i]}, esperado={expected_displacement}"
    
    def test_motion_statistics(self):
        """Testa estatísticas de movimento"""
        # Criar sequência com movimento conhecido
        movements = [0, 10, 15, 5, 20]  # Deslocamentos esperados
        
        for i, movement in enumerate(movements):
            if i == 0:
                bbox = [100, 100, 200, 300]  # Posição inicial
            else:
                # Calcular posição baseada no movimento acumulado
                total_movement = sum(movements[1:i+1])
                bbox = [100 + total_movement, 100, 200 + total_movement, 300]
            
            self.motion_analyzer.update_and_displacement(
                self.camera_id, self.track_id, bbox
            )
        
        # Obter estatísticas
        stats = self.motion_analyzer.get_track_motion_stats(self.camera_id, self.track_id)
        
        assert stats["exists"] is True
        assert stats["track_id"] == self.track_id
        assert stats["frame_count"] == len(movements)
        assert stats["displacements_count"] == len(movements) - 1
        
        # Verificar se mediana está no range esperado
        expected_median = sorted(movements[1:])[len(movements[1:])//2]  # Mediana dos movimentos
        assert abs(stats["median_displacement"] - expected_median) < 2, \
            f"Median displacement={stats['median_displacement']}, esperado~{expected_median}"
    
    def test_multiple_tracks(self):
        """Testa múltiplos tracks simultaneamente"""
        track_ids = [1, 2, 3]
        
        # Criar movimento diferente para cada track
        for frame in range(5):
            for i, track_id in enumerate(track_ids):
                # Cada track se move de forma diferente
                movement = (i + 1) * 5  # Track 1: 5px, Track 2: 10px, Track 3: 15px
                x_offset = frame * movement
                bbox = [100 + x_offset + i*300, 100, 200 + x_offset + i*300, 300]
                
                self.motion_analyzer.update_and_displacement(
                    self.camera_id, track_id, bbox
                )
        
        # Verificar estatísticas de cada track
        all_stats = self.motion_analyzer.get_all_motion_stats(self.camera_id)
        assert len(all_stats) == 3
        
        for stats in all_stats:
            track_id = stats["track_id"]
            expected_movement = track_id * 5
            
            # Mediana deve estar próxima do movimento esperado
            assert abs(stats["median_displacement"] - expected_movement) < 1, \
                f"Track {track_id}: median={stats['median_displacement']}, esperado={expected_movement}"

def test_integration_tracker_and_motion():
    """Teste de integração entre tracker e motion analyzer"""
    tracker = VisionTracker()
    motion_analyzer = MotionAnalyzer()
    camera_id = "integration_test"
    
    # Simular sequência de detecções com movimento
    sequences = [
        [100, 100, 200, 300],  # Frame 1
        [105, 100, 205, 300],  # Frame 2: movimento de 5px
        [110, 100, 210, 300],  # Frame 3: movimento de 5px
        [115, 100, 215, 300],  # Frame 4: movimento de 5px
    ]
    
    track_id = None
    for frame, bbox in enumerate(sequences):
        # Atualizar tracker
        track_ids = tracker.update(camera_id, [bbox])
        assert len(track_ids) == 1
        
        if track_id is None:
            track_id = track_ids[0]
        else:
            assert track_ids[0] == track_id  # ID deve ser consistente
        
        # Atualizar motion analyzer
        displacement = motion_analyzer.update_and_displacement(camera_id, track_id, bbox)
        
        if frame == 0:
            assert displacement == 0.0  # Primeiro frame
        else:
            assert abs(displacement - 5.0) < 0.1  # Movimento de 5px esperado
        
        # Verificar frames confirmed
        frames_conf = tracker.frames_confirmed(camera_id, track_id)
        if frame >= 3:  # Após confirmação
            assert frames_conf > 0

def test_global_functions():
    """Testa funções globais de conveniência"""
    camera_id = "global_test"
    
    # Testar funções globais do tracker
    track_ids = update(camera_id, [[100, 100, 200, 300]])
    assert len(track_ids) == 1
    
    track_id = track_ids[0]
    confirmed = frames_confirmed(camera_id, track_id)
    assert confirmed == 0  # Ainda não confirmado
    
    # Testar função global de movimento
    displacement = update_and_displacement(camera_id, track_id, [105, 100, 205, 300])
    # Primeiro update no motion analyzer retorna 0
    assert displacement == 0.0
    
    # Segundo update deve mostrar movimento
    displacement = update_and_displacement(camera_id, track_id, [110, 100, 210, 300])
    assert displacement == 5.0
    
    # Reset
    reset(camera_id)
    
    # Verificar reset
    new_track_ids = update(camera_id, [[100, 100, 200, 300]])
    assert new_track_ids[0] == 1  # ID resetado

if __name__ == "__main__":
    print("Executando testes de tracking e movimento...")
    
    try:
        # Testes básicos
        print("✓ Testando tracker...")
        test_tracker = TestVisionTracker()
        test_tracker.setup_method()
        test_tracker.test_single_detection_tracking()
        test_tracker.test_persistent_tracking()
        test_tracker.test_frames_confirmed_growth()
        print("✓ Tracker OK")
        
        print("✓ Testando motion analyzer...")
        test_motion = TestMotionAnalyzer()
        test_motion.setup_method()
        test_motion.test_stationary_object()
        test_motion.test_constant_movement()
        test_motion.test_diagonal_movement()
        print("✓ Motion analyzer OK")
        
        print("✓ Testando integração...")
        test_integration_tracker_and_motion()
        test_global_functions()
        print("✓ Integração OK")
        
        print("\n🎉 Todos os testes passaram!")
        print("\nCritérios de aceite atendidos:")
        print("✓ Rastros estáveis em sequência ≥ 15 frames")
        print("✓ frames_confirmed cresce estável")
        print("✓ displacement responde a movimento")
        print("✓ IDs persistem com pequenas variações")
        
    except Exception as e:
        print(f"❌ Teste falhou: {e}")
        import traceback
        traceback.print_exc()
        
    print("\nPara executar todos os testes:")
    print("pytest tests/test_tracking_motion.py -v")