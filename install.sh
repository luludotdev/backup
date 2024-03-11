#!/usr/bin/env bash

install_dir="${BACKUP_INSTALL_DIR:-/usr/local/bin}"
script_name="${BACKUP_SCRIPT_NAME:-backup}"

# deno
if command -v deno >/dev/null; then
  echo "" > /dev/null
else
  curl -fsSL https://deno.land/install.sh | DENO_INSTALL="/usr/local" sh
fi

# script
script_path="$install_dir/$script_name"
wget -q -O $script_path https://raw.githubusercontent.com/luludotdev/backup/master/backup.ts
chmod +x $script_path

echo "backup script installed to $script_path"

# borg
if command -v borg >/dev/null; then
  echo "" > /dev/null
else
  # TODO: Install borg automatically
  echo "make sure to install borg"
  echo "https://borgbackup.readthedocs.io/en/stable/installation.html"
fi
