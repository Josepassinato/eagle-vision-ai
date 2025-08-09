#!/usr/bin/env python3
"""
Cliente Face Recognition para Visão de Águia
Integração InsightFace-REST + Supabase
"""

import base64
import os
import requests
import json
from typing import List, Dict, Any, Optional
from supabase import create_client, Client

class FaceClient:
    def __init__(
        self, 
        face_service_url: str = "http://localhost:18081",
        supabase_url: Optional[str] = None,
        supabase_service_key: Optional[str] = None
    ):
        """
        Inicializa cliente de reconhecimento facial
        
        Args:
            face_service_url: URL do serviço InsightFace-REST
            supabase_url: URL do Supabase (ou env SUPABASE_URL)
            supabase_service_key: Service role key (ou env SUPABASE_SERVICE_ROLE_KEY)
        """
        self.face_service_url = face_service_url.rstrip('/')
        
        # Configurar Supabase
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        self.supabase_key = supabase_service_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError(
                "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem ser configurados"
            )
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
    def health_check(self) -> Dict[str, Any]:
        """Verifica saúde do serviço de face"""
        try:
            response = requests.get(f"{self.face_service_url}/", timeout=10)
            response.raise_for_status()
            return {"status": "ok", "service": "face", "response": response.json()}
        except Exception as e:
            return {"status": "error", "service": "face", "error": str(e)}
    
    def embed_face(self, jpg_b64: str) -> List[float]:
        """
        Gera embedding facial a partir de imagem base64
        
        Args:
            jpg_b64: Imagem JPEG em base64
            
        Returns:
            Lista de 512 floats representando o embedding facial
            
        Raises:
            Exception: Se não conseguir gerar embedding
        """
        try:
            # Remove header se presente
            if ',' in jpg_b64:
                jpg_b64 = jpg_b64.split(',')[1]
            
            # Payload para InsightFace-REST
            payload = {
                "images": {
                    "data": [jpg_b64]
                },
                "extract_embedding": True,
                "extract_ga": False,
                "api_ver": "1"
            }
            
            response = requests.post(
                f"{self.face_service_url}/extract",
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Verificar se há faces detectadas
            if not result.get("data") or len(result["data"]) == 0:
                raise Exception("Nenhuma face detectada na imagem")
            
            # Pegar embedding da primeira face
            first_face = result["data"][0]
            if "embedding" not in first_face:
                raise Exception("Embedding não gerado")
            
            embedding = first_face["embedding"]
            
            # Validar tamanho do embedding
            if len(embedding) != 512:
                raise Exception(f"Embedding deve ter 512 dimensões, obteve {len(embedding)}")
            
            return embedding
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Erro ao conectar com serviço de face: {e}")
        except Exception as e:
            raise Exception(f"Erro ao gerar embedding: {e}")
    
    def match_face(self, jpg_b64: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Encontra faces similares no banco usando RPC match_face
        
        Args:
            jpg_b64: Imagem JPEG em base64
            top_k: Número máximo de resultados
            
        Returns:
            Lista de dicionários com {id, name, similarity}
            
        Raises:
            Exception: Se não conseguir fazer matching
        """
        try:
            # Gerar embedding da imagem
            embedding = self.embed_face(jpg_b64)
            
            # Chamar RPC match_face no Supabase
            result = self.supabase.rpc(
                "match_face",
                {
                    "query": embedding,
                    "k": top_k
                }
            ).execute()
            
            if result.data is None:
                return []
            
            # Formatar resultado
            matches = []
            for row in result.data:
                matches.append({
                    "id": row["id"],
                    "name": row["name"],
                    "similarity": float(row["similarity"])
                })
            
            return matches
            
        except Exception as e:
            raise Exception(f"Erro ao fazer matching facial: {e}")
    
    def add_person_face(self, name: str, jpg_b64: str) -> str:
        """
        Adiciona nova pessoa com embedding facial
        
        Args:
            name: Nome da pessoa
            jpg_b64: Imagem JPEG em base64
            
        Returns:
            ID da pessoa criada
        """
        try:
            # Gerar embedding
            embedding = self.embed_face(jpg_b64)
            
            # Inserir pessoa no banco
            result = self.supabase.table("people").insert({
                "name": name,
                "face_embedding": embedding
            }).execute()
            
            if not result.data:
                raise Exception("Falha ao inserir pessoa")
            
            return result.data[0]["id"]
            
        except Exception as e:
            raise Exception(f"Erro ao adicionar pessoa: {e}")


# Funções de conveniência
def embed_face(jpg_b64: str, face_service_url: str = "http://localhost:18081") -> List[float]:
    """Função utilitária para gerar embedding facial"""
    client = FaceClient(face_service_url)
    return client.embed_face(jpg_b64)


def match_face(
    jpg_b64: str, 
    top_k: int = 5,
    face_service_url: str = "http://localhost:18081"
) -> List[Dict[str, Any]]:
    """Função utilitária para matching facial"""
    client = FaceClient(face_service_url)
    return client.match_face(jpg_b64, top_k)


if __name__ == "__main__":
    # Teste básico
    print("Testando cliente Face Recognition...")
    
    try:
        client = FaceClient()
        health = client.health_check()
        print(f"Health check: {health}")
        
        if health["status"] == "ok":
            print("✓ Serviço de face está funcionando")
        else:
            print("❌ Serviço de face com problemas")
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        print("Certifique-se de que o serviço InsightFace-REST está rodando na porta 18081")
        print("E que as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão configuradas")