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

# Build-time model download with checksum verification
ARG YOLO_MODEL_URL
ARG YOLO_MODEL_SHA256
ENV YOLO_MODEL=/app/models/yolov8x.pt

# Download model weights at build time if URL provided
RUN if [ -n "$YOLO_MODEL_URL" ]; then \
      echo "Downloading YOLO weights from $YOLO_MODEL_URL" && \
      wget -O /app/models/yolov8x.pt "$YOLO_MODEL_URL" && \
      if [ -n "$YOLO_MODEL_SHA256" ]; then \
        echo "$YOLO_MODEL_SHA256  /app/models/yolov8x.pt" > /app/models/yolov8x.pt.sha256 && \
        echo "Verifying model checksum..." && \
        sha256sum -c /app/models/yolov8x.pt.sha256 && \
        echo "✓ Model checksum verified"; \
      fi; \
    else \
      echo "YOLO_MODEL_URL not provided, weights will be obtained at runtime"; \
    fi

# Expor porta
EXPOSE 18060

# Comando para executar
CMD ["python3", "main.py"]