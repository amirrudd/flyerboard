# Convex backups and data export

**Backups are Convex's job, not ours.** The dashboard has a Backup & Restore page
(Deployment Settings → Backup & Restore) that takes manual backups and schedules
automated ones. On the Pro plan, periodic backups run daily (7-day retention) or
weekly (14-day). Verified against Convex docs 2026-09-05:
https://docs.convex.dev/database/backup-restore

**So do not build a backup system here.** If you are worried about data loss, the
answer is a click in the dashboard, not a script in this repo.

The CLI commands below exist for two things the dashboard does not cover.

## 1. Getting the data OUT (portability)

The exit path if Convex ever has to be left. See
`docs/architecture/design-decisions.md` § "Convex lock-in".

The dashboard can download a backup too — this is the scriptable equivalent, not
the only way out.

    npx convex export --prod --include-file-storage --path convex-snapshots/prod-$(date +%Y-%m-%d).zip

Produces a ZIP with one `documents.jsonl` per table, plus a `_storage/` folder.
That format is the thing that makes migration tractable — plain JSONL, no
proprietary encoding.

**It does not include R2 images.** Listing photos live in Cloudflare R2 and have
their own story (`docs/guides/r2-cdn-setup.md`). A snapshot restores the
database, not the pictures.

## 2. A snapshot right before something risky

Take one before a prod migration (`npx convex run migrations:<name>`) or a schema
change that drops or renames a field. The dashboard's own manual backup does this
just as well — use whichever is in front of you.

## Restoring

    npx convex import --deployment doting-dogfish-130 --replace-all convex-snapshots/<file>.zip   # -> dev
    npx convex import --prod --replace-all convex-snapshots/<file>.zip                            # -> PROD, destructive

**Always name the target.** These commands replace every table in whatever
deployment they hit, and `import` with no flag silently defaults to "your dev
deployment" — which is a guess about your shell state, not a decision you made.
Spell it out: `--deployment doting-dogfish-130` for dev, `--prod` for prod.
(The flag is `--deployment`, not `--deployment-name`; it takes a deployment name
like `doting-dogfish-130`.)

Three gotchas that cost time if you hit them cold:

- `export` takes `--path <file>`. `import` takes the path **positionally**. They
  differ, and this is the most common failure.
- `import` needs `--replace-all` when the target deployment already has tables.
  Without it the import refuses rather than merging.
- Neither command asks which deployment you meant. Pin it explicitly, every time.

The `--prod` form replaces production data. It is for a real recovery only, and
the dashboard's restore is the friendlier route to the same place.

## Snapshots contain PII

Real emails, phone numbers, and chat messages. `.gitignore` excludes
`convex-snapshots/` — leave them there, and delete them when you are done.

## Deployments

prod `resilient-pheasant-112`, dev `doting-dogfish-130`.
