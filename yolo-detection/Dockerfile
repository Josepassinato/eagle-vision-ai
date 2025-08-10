# Dockerfile para YOLO Person Detection
FROM nvidia/cuda:12.1-runtime-ubuntu22.04

# Evitar prompts interativos
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Copiar requirements primeiro (cache layer)
COPY requirements.txt .

# Instalar PyTorch com CUDA 12.1 e, em seguida, as demais dependências
RUN pip3 install --no-cache-dir --index-url https://download.pytorch.org/whl/cu121 \
    torch torchvision torchaudio && \
    pip3 install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY . .

# Criar diretório para modelos
RUN mkdir -p /app/models

# Opção de baixar o peso no build (informe ARG YOLO_MODEL_URL)
ARG YOLO_MODEL_URL
ENV YOLO_MODEL=/app/models/yolov8x.pt
RUN if [ -n "$YOLO_MODEL_URL" ]; then \
      echo "Baixando YOLO weights de $YOLO_MODEL_URL" && \
      wget -O /app/models/yolov8x.pt "$YOLO_MODEL_URL"; \
    else \
      echo "YOLO_MODEL_URL não definido, pesos serão obtidos em runtime"; \
    fi

# Expor porta
EXPOSE 18060

# Comando para executar
CMD ["python3", "main.py"]