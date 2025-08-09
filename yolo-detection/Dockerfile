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

# Instalar dependências Python
RUN pip3 install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY . .

# Criar diretório para modelos
RUN mkdir -p /app/models

# Baixar modelo YOLO (opcional - pode ser feito em runtime)
# RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8x.pt')"

# Expor porta
EXPOSE 18060

# Comando para executar
CMD ["python3", "main.py"]