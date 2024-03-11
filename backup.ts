#!/usr/bin/env -S deno run --ext=ts --allow-run --allow-read --allow-sys

import * as hex from "https://deno.land/std@0.219.0/encoding/hex.ts";
import * as fs from "https://deno.land/std@0.219.0/fs/mod.ts";
import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";

function borg(...args: string[]): Promise<Deno.CommandOutput> {
  return new Deno.Command("borg", { args }).output();
}

const command = new Command()
  .name("backup")
  .option("-v --verbose", "Enable verbose logging")
  .option(
    "--no-init",
    "Don't automatically init borg repo if it doesn't already exist",
  )
  .option("-N --name <name:string>", "Name for backups unique to the repo", {
    required: true,
  })
  .option("-R --repo <path:file>", "Path to borg repo", { required: true })
  .arguments("<...PATHS>")
  .action(async ({ verbose, init, name, repo }, ...paths) => {
    try {
      await borg("-V");
    } catch {
      console.log("missing `borg` binary");
      console.log(
        "https://borgbackup.readthedocs.io/en/stable/installation.html",
      );
      Deno.exit(1);
    }

    const exists = await fs.exists(repo, {
      isReadable: true,
      isDirectory: true,
    });

    if (!exists) {
      if (!init) {
        console.log("backup repo does not exist and `--no-init` was passed");
        Deno.exit(1);
      }

      const resp = await borg("init", "-e=none", repo);
      if (!resp.success) {
        console.log("failed to init repo");
        if (verbose) console.log(new TextDecoder().decode(resp.stderr));
        Deno.exit(1);
      }
    }

    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const hash = hex.encodeHex(bytes);

    const resp = await borg(
      "create",
      "--stats",
      `${repo}::${name}-${hash}`,
      ...paths,
    );

    if (!resp.success) {
      console.log("failed to create backup");
      if (verbose) console.log(new TextDecoder().decode(resp.stderr));
      Deno.exit(1);
    }

    if (verbose) console.log(new TextDecoder().decode(resp.stderr));

    // TODO: Automatic rclone
  });

if (import.meta.main) {
  await command.parse(Deno.args);
}
