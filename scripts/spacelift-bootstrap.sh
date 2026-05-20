#!/bin/sh
set -eu

export PATH="$HOME/.local/node/bin:$HOME/.railway/bin:$PATH"

os_name="$(uname -s)"

if [ "$os_name" = "Darwin" ]; then
  node_bin="$(command -v node)"
else
  node_bin="$(command -v node 2>/dev/null || true)"
fi

if [ "$os_name" != "Darwin" ]; then
  arch="$(uname -m)"
  case "$arch" in
    x86_64 | amd64) node_arch="x64" ;;
    arm64 | aarch64) node_arch="arm64" ;;
    *) echo "Unsupported Node architecture: $arch" >&2; exit 1 ;;
  esac

  tmp_dir="$(mktemp -d)"
  rm -rf "$HOME/.local/node"
  mkdir -p "$HOME/.local/node"
  curl -fsSL "https://nodejs.org/dist/v24.11.1/node-v24.11.1-linux-${node_arch}.tar.xz" -o "$tmp_dir/node.tar.xz"
  if command -v xz >/dev/null 2>&1; then
    tar -xJf "$tmp_dir/node.tar.xz" -C "$HOME/.local/node" --strip-components=1
  else
    curl -fsSL "https://nodejs.org/dist/v24.11.1/node-v24.11.1-linux-${node_arch}.tar.gz" -o "$tmp_dir/node.tar.gz"
    tar -xzf "$tmp_dir/node.tar.gz" -C "$HOME/.local/node" --strip-components=1
  fi
  if [ ! -x "$HOME/.local/node/bin/node" ]; then
    tar -tf "$tmp_dir/node.tar.xz" | sed -n '1,20p'
    find "$HOME/.local/node" -maxdepth 3 -type f | sed -n '1,40p'
    echo "Node install failed: $HOME/.local/node/bin/node missing" >&2
    exit 1
  fi
  node_bin="$HOME/.local/node/bin/node"
fi

"$node_bin" --version

if [ -z "${SPACELIFT_POC_FIXTURE:-}" ] && ! command -v railway >/dev/null 2>&1; then
  curl -fsSL https://railway.com/install.sh | sh
fi

if command -v railway >/dev/null 2>&1; then
  railway --version
fi
