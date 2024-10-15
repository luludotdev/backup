#!/usr/bin/env -S deno run --ext=ts --allow-run --allow-read --allow-sys

import {
  ArgumentValue,
  Command,
  Type,
  ValidationError,
} from "jsr:@cliffy/command@1.0.0-rc.7";
import * as hex from "jsr:@std/encoding@1.0.5/hex";
import * as fs from "jsr:@std/fs@1.0.4";
import * as path from "jsr:@std/path@1.0.6";
import * as semver from "jsr:@std/semver@1.0.3";

function command(name: string, ...args: string[]): Promise<Deno.CommandOutput> {
  return new Deno.Command(name, { args }).output();
}

function print(encoded: Uint8Array): void {
  console.log(new TextDecoder().decode(encoded));
}

class KeepType extends Type<string> {
  private readonly units = ["h", "d", "w", "m", "y"];

  public parse({ label, name, value }: ArgumentValue): string {
    const [end, ...rest] = value.split("").reverse();
    const start = rest.reverse().join("");

    if (!this.units.includes(end)) {
      throw new ValidationError(
        `${label} "${name}" has an invalid unit. Allowed values are: ${
          this.units.join(", ")
        }`,
      );
    }

    const num = Number.parseInt(start, 10);
    if (Number.isNaN(num)) {
      throw new ValidationError(`${label} "${name}" is invalid.`);
    }

    const unit = end.replace("h", "H");
    return `${num}${unit}`;
  }
}

const cli = new Command()
  .name("backup")
  .type("keep", new KeepType())
  .option("-v --verbose", "Enable verbose logging")
  .option(
    "--no-init",
    "Don't automatically init borg repo if it doesn't already exist",
  )
  .option("-N --name <name:string>", "Name for backups unique to the repo", {
    required: true,
  })
  .option("-R --repo <path:file>", "Path to borg repo", { required: true })
  .option("--no-compact", "Disable automatic archive compacting")
  .option("--no-prune", "Disable automatic archive pruning")
  .option("-K --keep <value:keep>", "Timeframe to keep backups for (eg: 7d)", {
    required: true,
  })
  .option("-S --sync", "Sync repo using rclone", {
    depends: ["rclone-remote", "rclone-root"],
  })
  .option("--rclone-remote <remote:string>", "Rclone remote name")
  .option("--rclone-root <root:string>", "Rclone remote root directory", {
    default: ".",
  })
  .arguments("<...PATHS>")
  .action(async (args, ...paths) => {
    const borg = (...args: string[]) => command("borg", ...args);
    const rclone = (...args: string[]) => command("rclone", ...args);

    let canCompact = false;
    try {
      const resp = await borg("-V");
      if (!resp.success) throw new Error();

      const version = new TextDecoder().decode(resp.stdout).replace(
        "borg ",
        "",
      );

      const parsed = semver.parse(version);
      const isOneDotFour = semver.greaterOrEqual(parsed, semver.parse("1.4.0"));
      if (isOneDotFour) canCompact = true;
    } catch {
      console.log("missing `borg` binary");
      console.log(
        "https://borgbackup.readthedocs.io/en/stable/installation.html",
      );

      Deno.exit(1);
    }

    // TODO: Dry-run
    const {
      verbose,
      init,
      name,
      repo,
      compact,
      prune,
      keep,
      sync,
    } = args;

    if (sync) {
      try {
        await rclone("-V");
      } catch {
        console.log("missing `rclone` binary");
        console.log("https://rclone.org/install/");
        Deno.exit(1);
      }
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

      await Deno.mkdir(repo, { recursive: true });

      const resp = await borg("init", "-e=none", repo);
      if (!resp.success) {
        console.log("failed to init repo");
        if (verbose) print(resp.stderr);
        Deno.exit(1);
      }

      if (verbose) console.log(`created repo at ${path.resolve(repo)}`);
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
      if (verbose) print(resp.stderr);
      Deno.exit(1);
    }

    if (verbose) {
      console.log("backup info");
      print(resp.stderr);
    }

    if (prune) {
      const resp = await borg(
        "prune",
        repo,
        "--stats",
        `--prefix=${name}-`,
        "--keep-last=1",
        `--keep-within=${keep}`,
      );

      if (!resp.success) {
        console.log("failed to prune backups");
        if (verbose) print(resp.stderr);
        Deno.exit(1);
      }

      if (verbose) {
        console.log("prune info");
        print(resp.stderr);
      }

      if (compact && canCompact) {
        const resp = await borg(
          "compact",
          "--cleanup-commits",
          repo,
        );

        if (!resp.success) {
          console.log("failed to compact backups");
          if (verbose) print(resp.stderr);
        }
      }
    }

    if (sync) {
      const { rcloneRoot, rcloneRemote } = args;
      const resp = await rclone(
        "sync",
        repo,
        `${rcloneRemote}:${rcloneRoot}/${name}`,
      );

      if (!resp.success) {
        console.log("failed to sync");
        if (verbose) print(resp.stderr);
        Deno.exit(1);
      }

      if (verbose) console.log("synced successfully");
    }
  });

if (import.meta.main) {
  await cli.parse(Deno.args);
}
