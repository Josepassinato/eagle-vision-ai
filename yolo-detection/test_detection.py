#!/usr/bin/env python3
"""
Testes unitários para o serviço de detecção YOLO
"""

import base64
import io
import numpy as np
import pytest
import requests
from PIL import Image
import cv2

# URL do serviço (ajustar conforme necessário)
BASE_URL = "http://localhost:18060"

def create_test_image(width=640, height=480, with_person=True):
    """Cria uma imagem de teste"""
    # Criar imagem RGB simples
    img = np.zeros((height, width, 3), dtype=np.uint8)
    
    if with_person:
        # Adicionar um retângulo simulando uma pessoa
        cv2.rectangle(img, (100, 100), (200, 300), (255, 255, 255), -1)
        cv2.rectangle(img, (150, 120), (180, 160), (200, 180, 160), -1)  # "rosto"
    
    return img

def image_to_base64(img_array):
    """Converte numpy array para base64"""
    _, buffer = cv2.imencode('.jpg', img_array)
    img_bytes = buffer.tobytes()
    return base64.b64encode(img_bytes).decode('utf-8')

def test_health_endpoint():
    """Testa o endpoint de health"""
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "ok"
    assert "model" in data
    assert "device" in data

def test_detect_valid_image():
    """Testa detecção com imagem válida"""
    img = create_test_image()
    b64_img = image_to_base64(img)
    
    payload = {"jpg_b64": b64_img}
    response = requests.post(f"{BASE_URL}/detect", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert "boxes" in data
    assert isinstance(data["boxes"], list)
    
    # Verificar estrutura dos boxes se houver detecções
    for box in data["boxes"]:
        assert "score" in box
        assert "cls" in box
        assert "xyxy" in box
        assert "xywhn" in box
        assert box["cls"] == "person"
        assert 0.0 <= box["score"] <= 1.0
        assert len(box["xyxy"]) == 4
        assert len(box["xywhn"]) == 4
        
        # Verificar se coordenadas normalizadas estão entre 0 e 1
        for coord in box["xywhn"]:
            assert 0.0 <= coord <= 1.0

def test_detect_invalid_base64():
    """Testa detecção com base64 inválido"""
    payload = {"jpg_b64": "invalid_base64_string"}
    response = requests.post(f"{BASE_URL}/detect", json=payload)
    
    assert response.status_code == 400
    assert "Base64 inválido" in response.json()["detail"]

def test_detect_large_image():
    """Testa detecção com imagem muito grande"""
    # Criar imagem grande (simular > 2MB)
    large_img = create_test_image(width=4000, height=3000)
    b64_img = image_to_base64(large_img)
    
    payload = {"jpg_b64": b64_img}
    response = requests.post(f"{BASE_URL}/detect", json=payload)
    
    # Pode retornar 413 (muito grande) ou 200 (se não for realmente > 2MB)
    assert response.status_code in [200, 413]

def test_detect_empty_image():
    """Testa detecção com imagem vazia"""
    empty_img = np.zeros((100, 100, 3), dtype=np.uint8)
    b64_img = image_to_base64(empty_img)
    
    payload = {"jpg_b64": b64_img}
    response = requests.post(f"{BASE_URL}/detect", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    # Imagem vazia provavelmente não terá detecções
    assert isinstance(data["boxes"], list)

if __name__ == "__main__":
    print("Executando testes básicos...")
    
    try:
        test_health_endpoint()
        print("✓ Health endpoint OK")
        
        test_detect_valid_image()
        print("✓ Detecção com imagem válida OK")
        
        test_detect_invalid_base64()
        print("✓ Teste base64 inválido OK")
        
        test_detect_empty_image()
        print("✓ Teste imagem vazia OK")
        
        print("\nTodos os testes passaram! 🎉")
        
    except Exception as e:
        print(f"❌ Teste falhou: {e}")
        print("Certifique-se de que o serviço está rodando em http://localhost:18060")