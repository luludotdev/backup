#!/usr/bin/env bash

if command -v deno >/dev/null; then
  echo "" > /dev/null
else
  curl -fsSL https://deno.land/install.sh | DENO_INSTALL="/usr/local" sh
fi

wget -O /usr/local/bin/backup https://raw.githubusercontent.com/luludotdev/backup/master/backup.ts
chmod +x /usr/local/bin/backup
