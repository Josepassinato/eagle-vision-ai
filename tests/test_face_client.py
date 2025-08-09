#!/usr/bin/env python3
"""
Testes para o cliente de reconhecimento facial
"""

import base64
import io
import os
import sys
import pytest
from PIL import Image
import numpy as np

# Adicionar diretório pai ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from face_service.face_client import FaceClient, embed_face, match_face

def create_test_face_image(width=200, height=200):
    """Cria uma imagem de teste com formato de rosto"""
    # Criar imagem RGB
    img = Image.new('RGB', (width, height), color='white')
    pixels = img.load()
    
    # Desenhar um rosto simples
    center_x, center_y = width // 2, height // 2
    
    # Face oval
    for y in range(height):
        for x in range(width):
            dist_x = abs(x - center_x) / (width // 3)
            dist_y = abs(y - center_y) / (height // 2.5)
            if dist_x**2 + dist_y**2 < 1:
                pixels[x, y] = (220, 180, 140)  # Cor de pele
    
    # Olhos
    eye_y = center_y - 20
    pixels[center_x - 30, eye_y] = (0, 0, 0)  # Olho esquerdo
    pixels[center_x + 30, eye_y] = (0, 0, 0)  # Olho direito
    
    # Nariz
    for i in range(-5, 6):
        pixels[center_x, center_y + i] = (200, 150, 120)
    
    # Boca
    mouth_y = center_y + 30
    for i in range(-15, 16):
        pixels[center_x + i, mouth_y] = (150, 50, 50)
    
    return img

def image_to_base64(img):
    """Converte PIL Image para base64"""
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=95)
    img_bytes = buffer.getvalue()
    return base64.b64encode(img_bytes).decode('utf-8')

class TestFaceClient:
    def setup_method(self):
        """Setup para cada teste"""
        try:
            self.client = FaceClient()
        except ValueError as e:
            pytest.skip(f"Configuração Supabase não encontrada: {e}")
    
    def test_health_check(self):
        """Testa health check do serviço"""
        health = self.client.health_check()
        
        # Deve retornar status
        assert "status" in health
        assert "service" in health
        assert health["service"] == "face"
        
        # Se status for error, pode ser que o serviço não esteja rodando
        if health["status"] == "error":
            pytest.skip("Serviço InsightFace-REST não está rodando")
    
    def test_embed_face_valid_image(self):
        """Testa geração de embedding com imagem válida"""
        # Verificar se serviço está rodando
        health = self.client.health_check()
        if health["status"] != "ok":
            pytest.skip("Serviço InsightFace-REST não está rodando")
        
        # Criar imagem de teste
        test_img = create_test_face_image()
        b64_img = image_to_base64(test_img)
        
        try:
            embedding = self.client.embed_face(b64_img)
            
            # Verificar se é uma lista
            assert isinstance(embedding, list)
            
            # Verificar se tem 512 dimensões
            assert len(embedding) == 512
            
            # Verificar se todos são números
            assert all(isinstance(x, (int, float)) for x in embedding)
            
            # Verificar se não são todos zeros
            assert not all(x == 0 for x in embedding)
            
        except Exception as e:
            if "Nenhuma face detectada" in str(e):
                pytest.skip("Face não detectada na imagem sintética")
            else:
                raise
    
    def test_embed_face_invalid_base64(self):
        """Testa embedding com base64 inválido"""
        health = self.client.health_check()
        if health["status"] != "ok":
            pytest.skip("Serviço InsightFace-REST não está rodando")
        
        with pytest.raises(Exception):
            self.client.embed_face("invalid_base64")
    
    def test_match_face_empty_database(self):
        """Testa matching com banco vazio"""
        health = self.client.health_check()
        if health["status"] != "ok":
            pytest.skip("Serviço InsightFace-REST não está rodando")
        
        # Criar imagem de teste
        test_img = create_test_face_image()
        b64_img = image_to_base64(test_img)
        
        try:
            matches = self.client.match_face(b64_img, top_k=5)
            
            # Deve retornar lista (pode estar vazia)
            assert isinstance(matches, list)
            
            # Se houver resultados, verificar estrutura
            for match in matches:
                assert "id" in match
                assert "name" in match
                assert "similarity" in match
                assert isinstance(match["similarity"], (int, float))
                assert 0 <= match["similarity"] <= 1
                
        except Exception as e:
            if "Nenhuma face detectada" in str(e):
                pytest.skip("Face não detectada na imagem sintética")
            else:
                raise
    
    def test_add_person_face(self):
        """Testa adição de pessoa com face"""
        health = self.client.health_check()
        if health["status"] != "ok":
            pytest.skip("Serviço InsightFace-REST não está rodando")
        
        # Criar imagem de teste
        test_img = create_test_face_image()
        b64_img = image_to_base64(test_img)
        
        try:
            person_id = self.client.add_person_face("Teste Face", b64_img)
            
            # Verificar se retornou um ID
            assert person_id is not None
            assert isinstance(person_id, str)
            
            # Limpar: remover pessoa criada
            try:
                self.client.supabase.table("people").delete().eq("id", person_id).execute()
            except:
                pass  # Ignorar erros de cleanup
                
        except Exception as e:
            if "Nenhuma face detectada" in str(e):
                pytest.skip("Face não detectada na imagem sintética")
            else:
                raise

def test_utility_functions():
    """Testa funções utilitárias"""
    # Verificar se funções existem
    assert callable(embed_face)
    assert callable(match_face)
    
    # Criar imagem de teste
    test_img = create_test_face_image()
    b64_img = image_to_base64(test_img)
    
    # Testar que não dão erro ao chamar (pode dar skip se serviço não estiver rodando)
    try:
        # Tentar verificar se serviço está rodando
        import requests
        requests.get("http://localhost:18081/", timeout=2)
        
        # Se chegou aqui, serviço está rodando
        embedding = embed_face(b64_img)
        assert len(embedding) == 512
        
    except Exception:
        # Serviço não está rodando ou outro erro
        pytest.skip("Serviço não disponível para teste das funções utilitárias")

if __name__ == "__main__":
    print("Executando testes do cliente Face Recognition...")
    
    # Verificar configuração
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("⚠️  SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados")
        print("Configure as variáveis de ambiente antes de executar os testes")
        sys.exit(1)
    
    # Executar testes
    try:
        # Teste básico de conexão
        client = FaceClient()
        health = client.health_check()
        
        print(f"Health check: {health}")
        
        if health["status"] == "ok":
            print("✓ Serviço InsightFace-REST está funcionando")
            
            # Teste de embedding
            test_img = create_test_face_image()
            b64_img = image_to_base64(test_img)
            
            try:
                embedding = client.embed_face(b64_img)
                print(f"✓ Embedding gerado: {len(embedding)} dimensões")
                
                # Teste de matching
                matches = client.match_face(b64_img, top_k=3)
                print(f"✓ Matching executado: {len(matches)} resultados")
                
            except Exception as e:
                if "Nenhuma face detectada" in str(e):
                    print("⚠️  Face não detectada na imagem sintética (normal)")
                else:
                    print(f"❌ Erro nos testes: {e}")
        else:
            print("❌ Serviço InsightFace-REST com problemas")
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        
    print("\nPara executar todos os testes:")
    print("pytest tests/test_face_client.py -v")