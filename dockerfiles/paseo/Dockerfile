FROM ghcr.io/getpaseo/paseo:0.1.103

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    procps \
    python3 \
    python3-pip \
    python3-venv \
    ripgrep \
    build-essential \
    jq \
    less \
    unzip \
    wget \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.80.2

USER paseo
RUN curl -fsSL https://claude.ai/install.sh | bash -s 2.1.201
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/paseo/.local/bin:${PATH}"

USER root
