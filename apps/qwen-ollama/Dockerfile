FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:11434
# Space-separated list — override via Railway env var
ENV OLLAMA_MODELS="qwen3:1.7b"
ENV OLLAMA_MAX_LOADED_MODELS=1
ENV OLLAMA_NUM_PARALLEL=1
ENV PORT=11434

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 11434

ENTRYPOINT ["/start.sh"]
