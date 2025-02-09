

# Setup llama-server for nvim FiM
## Less than 8GB Vram Model
Pull the cuda image
```
docker pull ghcr.io/ggerganov/llama.cpp:server-cuda                                                                                                                      │
```

Run the image with specific settings
```
docker run -d \
-v llama_server:/root/.cache/llama.cpp \
-p 127.0.0.1:8012:8012 \
--gpus all \
--memory=8g \
--cpus=4 \
--name llama-server-qwen-1.5b-nvim-infills \
ghcr.io/ggerganov/llama.cpp:server-cuda \
-hf ggml-org/Qwen2.5-Coder-1.5B-Q8_0-GGUF \
--port 8012 \
--host 0.0.0.0 \
-n 512 \
-ngl 99 \
--flash-attn \
-ub 1024 \
-b 1024 \
--ctx-size 0 \
--cache-reuse 256
```

Check `llama-server --help` for flag descriptions


# Running Ollama with docker
```
docker run \
-d \
--gpus=all \
-v ollama:/root/.ollama \
-p 0.0.0.0:11434:11434 \
--security-opt=no-new-privileges \
--cap-drop=ALL \
--cap-add=SYS_NICE \
--memory=16g \
--memory-swap=16g \
--cpus=4 \
--read-only \
--name ollama \
ollama/ollama
```
