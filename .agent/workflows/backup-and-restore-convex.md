# Backup and restore the Convex database

**Last executed**: NOT YET EXECUTED. The commands below are transcribed from the
Convex CLI's own `--help` output (verified 2026-09-05) but have not been run
end to end against this project. Until someone runs them and fills in this line
with a real date and the observed table count, treat this as an untested
procedure — which is to say, treat the project as having no verified backup.

Deployments: prod `resilient-pheasant-112`, dev `doting-dogfish-130`.

## Take a snapshot (read-only, safe against prod)

    npx convex export --prod --include-file-storage --path convex-snapshots/prod-$(date +%Y-%m-%d).zip

`--include-file-storage` pulls legacy `_storage` files. It does **not** pull R2
images — those live in Cloudflare R2 and are backed up separately (see
`docs/guides/r2-cdn-setup.md`). A snapshot restores the database, not the photos.

Snapshots contain real emails, phone numbers, and chat messages. `.gitignore`
excludes `convex-snapshots/`. Do not move one outside that directory.

## Verify a snapshot

    unzip -l convex-snapshots/<file>.zip
    unzip -p convex-snapshots/<file>.zip ads/documents.jsonl | wc -l

Expect one folder per table (the schema defines 18) plus a `_storage/` folder,
and a non-zero line count for `ads`.

## Restore

    npx convex import --replace-all convex-snapshots/<file>.zip           # -> dev
    npx convex import --prod --replace-all convex-snapshots/<file>.zip    # -> PROD, destructive

The path is **positional**. `export` uses `--path`, `import` does not — they
differ, and getting it wrong is the most common failure here. `--replace-all` is
needed whenever the target deployment already has tables; without it the import
refuses rather than merging.

**The prod form replaces production data.** Only run it during a real recovery,
and take a fresh snapshot of the current prod state first.

## First run: what to check

The restore-into-dev step is the one that turns a backup into a *verified*
backup. When someone runs it for the first time, record here whatever went
wrong — that failure is more valuable than the happy path.

## Cadence

No automation. Run the snapshot command before any prod migration
(`npx convex run migrations:<name>`) and before any schema change that drops or
renames a field.
