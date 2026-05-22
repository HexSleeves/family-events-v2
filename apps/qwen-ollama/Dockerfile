FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:11434
# Space-separated list — override via Railway env var
ENV OLLAMA_MODELS="qwen3:1.7b"
ENV OLLAMA_MAX_LOADED_MODELS=1
# Match the process-tag-queue worker CONCURRENCY (4). Ollama serializes
# requests per-model when NUM_PARALLEL=1, queueing 8 concurrent calls so
# the last ones blow the 45s edge-function LLM timeout. qwen3:1.7b uses
# ~2 GB per parallel slot; 4 slots = ~8 GB, fits Railway's default memory
# tier with headroom.
ENV OLLAMA_NUM_PARALLEL=4
ENV PORT=11434

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 11434

ENTRYPOINT ["/start.sh"]
