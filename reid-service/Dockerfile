FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

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
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Copiar requirements primeiro (cache layer)
COPY requirements.txt .

# Instalar dependências Python
RUN pip3 install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY . .

# Criar diretório para modelos
RUN mkdir -p /models

# Permitir download opcional do modelo no build
ARG REID_MODEL_URL
ENV REID_MODEL_PATH=/models/osnet_x0_75.onnx
ENV REID_INPUT_FORMAT=RGB
ENV PORT=18090
RUN if [ -n "$REID_MODEL_URL" ]; then \
      echo "Baixando OSNet de $REID_MODEL_URL" && \
      wget -O /models/osnet_x0_75.onnx "$REID_MODEL_URL"; \
    else \
      echo "REID_MODEL_URL não definido, monte /models ou defina REID_MODEL_URL no runtime"; \
    fi

# Expor porta
EXPOSE 18090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:18090/health || exit 1

# Comando para executar
CMD ["python3", "main.py"]