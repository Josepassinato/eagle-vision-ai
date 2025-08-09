import time
import types
from enricher.main import handle_realtime_payload, _is_duplicate, _mark_processed

# Mocks simples para validar fluxo lógico local sem Supabase

def test_realtime_event_processed_once(monkeypatch):
    # Evento válido
    ev = {
        'new': {
            'id': 123,
            'reason': 'face',
            'face_similarity': 0.80,
            'camera_id': 'cam-sim',
            'person_id': '00000000-0000-0000-0000-000000000001',
            'ts': time.time() - 0.1,
        }
    }

    # Mock process_event para evitar chamadas externas
    import enricher.main as em
    called = {'n': 0}
    def mock_process_event(e, jpg_b64=None):
        called['n'] += 1
        return True
    monkeypatch.setattr(em, 'process_event', mock_process_event)

    ok1 = handle_realtime_payload(ev)
    ok2 = handle_realtime_payload(ev)  # duplicado deve ser ignorado

    assert ok1 is True
    assert ok2 is False
    assert called['n'] == 1


def test_realtime_non_face_ignored():
    ev = {'new': {'id': 1, 'reason': 'reid+motion', 'face_similarity': None}}
    assert handle_realtime_payload(ev) is False


def test_realtime_missing_person_ignored(monkeypatch):
    ev = {'new': {'id': 2, 'reason': 'face', 'face_similarity': 0.9, 'camera_id': 'c1', 'ts': time.time()}}

    import enricher.main as em
    def mock_process_event(e, jpg_b64=None):
        # process_event retornará False devido a no_person
        return False
    monkeypatch.setattr(em, 'process_event', mock_process_event)

    assert handle_realtime_payload(ev) is False
