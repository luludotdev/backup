# Backup Script

## Dependencies

- [borg](https://borgbackup.readthedocs.io/en/stable/installation.html)
- [deno](https://docs.deno.com/runtime/manual/getting_started/installation) (installed automatically by the installation script)
- [rclone](https://rclone.org/install/) (optional, required if you want to use `--sync`)

## Installation

By default the install script will install both deno and the backup script to `/usr/local/bin`, which usually requires running the script as root.

You can set `BACKUP_INSTALL_DIR` and `BACKUP_SCRIPT_NAME` to customise the install directory and script filename respectively. This can be used to install for a single user, so that you dont need root.

```sh
# install as root for all users
curl -fsSL https://raw.githubusercontent.com/luludotdev/backup/master/install.sh | sh
```

```sh
# install for the current user
export BACKUP_INSTALL_DIR="$HOME/.local/bin"
curl -fsSL https://raw.githubusercontent.com/luludotdev/backup/master/install.sh | sh
```

## Usage

```sh
# show help
backup --help

# backup the contents of ~/Documents to ~/backup/documents
backup --name documents --repo ~/backup/documents --keep 7d ~/Documents
```
