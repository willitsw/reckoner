#!/bin/sh
set -eu

git_dir=$(git rev-parse --git-dir 2>/dev/null || true)
if [ -z "$git_dir" ]; then
  exit 0
fi

mkdir -p "$git_dir/hooks"
cp .githooks/pre-commit "$git_dir/hooks/pre-commit"
chmod +x "$git_dir/hooks/pre-commit"
