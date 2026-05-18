#!/usr/bin/env sh
set -eu

ollama serve &
serve_pid="$!"

until ollama list >/dev/null 2>&1; do
  sleep 1
done

for model in $OLLAMA_MODELS; do
  ollama pull "$model"
done

wait "$serve_pid"
