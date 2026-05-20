FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:11434
# Space-separated list — override via Railway env var, e.g. "qwen3:1.7b gemma3n:e4b"
ENV OLLAMA_MODELS="qwen3:1.7b gemma3n:e4b"
ENV PORT=11434

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 11434

ENTRYPOINT ["/start.sh"]
