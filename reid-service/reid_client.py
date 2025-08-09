#!/usr/bin/env python3
"""
Cliente Person Re-ID para Visão de Águia
Integração OSNet + Supabase
"""

import base64
import os
import requests
import json
from typing import List, Dict, Any, Optional

class ReIDClient:
    def __init__(self, reid_service_url: str = "http://localhost:18090"):
        """
        Inicializa cliente de Person Re-ID
        
        Args:
            reid_service_url: URL do serviço OSNet Re-ID
        """
        self.reid_service_url = reid_service_url.rstrip('/')
        
    def health_check(self) -> Dict[str, Any]:
        """Verifica saúde do serviço Re-ID"""
        try:
            response = requests.get(f"{self.reid_service_url}/health", timeout=10)
            response.raise_for_status()
            return {"status": "ok", "service": "reid", "response": response.json()}
        except Exception as e:
            return {"status": "error", "service": "reid", "error": str(e)}
    
    def embed_body(self, jpg_b64: str, xyxy: Optional[List[int]] = None) -> List[float]:
        """
        Gera embedding corporal a partir de imagem base64
        
        Args:
            jpg_b64: Imagem JPEG em base64
            xyxy: Coordenadas de crop [x1,y1,x2,y2] (opcional)
            
        Returns:
            Lista de 512 floats representando o embedding corporal
            
        Raises:
            Exception: Se não conseguir gerar embedding
        """
        try:
            # Remove header se presente
            if ',' in jpg_b64:
                jpg_b64 = jpg_b64.split(',')[1]
            
            # Payload para OSNet Re-ID
            payload = {
                "jpg_b64": jpg_b64
            }
            
            if xyxy is not None:
                payload["xyxy"] = xyxy
            
            response = requests.post(
                f"{self.reid_service_url}/embedding",
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Extrair vetor
            embedding = result["vec"]
            norm = result["norm"]
            
            # Validar tamanho do embedding
            if len(embedding) != 512:
                raise Exception(f"Embedding deve ter 512 dimensões, obteve {len(embedding)}")
            
            # Validar normalização
            if abs(norm - 1.0) > 0.01:
                print(f"Warning: Norma L2 não é ~1.0: {norm}")
            
            return embedding
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Erro ao conectar com serviço Re-ID: {e}")
        except Exception as e:
            raise Exception(f"Erro ao gerar embedding corporal: {e}")
    
    def match_body(
        self, 
        jpg_b64: str, 
        top_k: int = 5, 
        xyxy: Optional[List[int]] = None
    ) -> List[Dict[str, Any]]:
        """
        Encontra corpos similares no banco usando OSNet + Supabase
        
        Args:
            jpg_b64: Imagem JPEG em base64
            top_k: Número máximo de resultados
            xyxy: Coordenadas de crop [x1,y1,x2,y2] (opcional)
            
        Returns:
            Lista de dicionários com {id, name, similarity}
            
        Raises:
            Exception: Se não conseguir fazer matching
        """
        try:
            # Remove header se presente
            if ',' in jpg_b64:
                jpg_b64 = jpg_b64.split(',')[1]
            
            # Payload para matching
            payload = {
                "jpg_b64": jpg_b64,
                "top_k": top_k
            }
            
            if xyxy is not None:
                payload["xyxy"] = xyxy
            
            response = requests.post(
                f"{self.reid_service_url}/match",
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Formatar resultado
            matches = []
            for row in result["results"]:
                matches.append({
                    "id": row["id"],
                    "name": row["name"],
                    "similarity": float(row["similarity"])
                })
            
            return matches
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Erro ao conectar com serviço Re-ID: {e}")
        except Exception as e:
            raise Exception(f"Erro ao fazer matching corporal: {e}")


# Funções de conveniência
def embed_body(
    jpg_b64: str, 
    xyxy: Optional[List[int]] = None,
    reid_service_url: str = "http://localhost:18090"
) -> List[float]:
    """Função utilitária para gerar embedding corporal"""
    client = ReIDClient(reid_service_url)
    return client.embed_body(jpg_b64, xyxy)


def match_body(
    jpg_b64: str, 
    top_k: int = 5,
    xyxy: Optional[List[int]] = None,
    reid_service_url: str = "http://localhost:18090"
) -> List[Dict[str, Any]]:
    """Função utilitária para matching corporal"""
    client = ReIDClient(reid_service_url)
    return client.match_body(jpg_b64, top_k, xyxy)


if __name__ == "__main__":
    # Teste básico
    print("Testando cliente Person Re-ID...")
    
    try:
        client = ReIDClient()
        health = client.health_check()
        print(f"Health check: {health}")
        
        if health["status"] == "ok":
            print("✓ Serviço Re-ID está funcionando")
        else:
            print("❌ Serviço Re-ID com problemas")
            
    except Exception as e:
        print(f"❌ Erro: {e}")
        print("Certifique-se de que o serviço OSNet Re-ID está rodando na porta 18090")