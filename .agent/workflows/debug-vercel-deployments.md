# Debug Vercel production deployments (stale build / skipped build / alias race)

**Created**: 2026-07-02, after PR #269's merge deployment silently shipped the previous build.

## Symptoms
- PR merged, Vercel deployment for the merge commit shows **Ready**, but prod still serves the old JS bundle (`/assets/index-<hash>.js` hash unchanged).
- The GitHub deployment status flipped to `success` **seconds** after creation — a real build here takes minutes (`vercel-build.sh` runs `npx convex deploy --cmd 'npm run build'` for production).

## Diagnosis steps (no Vercel token needed — use gh + curl)
```bash
# 1. What does prod actually serve?
curl -sL https://www.flyerboard.com.au/ | grep -oE '/assets/index[^"]*\.js'
# grep the bundle for a marker only the new code contains, e.g.:
curl -s https://www.flyerboard.com.au/assets/index-<hash>.js | grep -c "img.flyerboard.com.au"

# 2. When did the deployment build, and how fast did it "succeed"?
gh api "repos/amirrudd/flyerboard/deployments?per_page=5" \
  --jq '.[] | "\(.created_at) \(.environment) sha:\(.sha[0:8]) id:\(.id)"'
gh api "repos/amirrudd/flyerboard/deployments/<id>/statuses" --jq '.[] | "\(.created_at) \(.state)"'
# created_at → success within ~2s = build was SKIPPED (old output reused).
# TWO success statuses on one deployment = it was redeployed/promoted later (manual action).
```

## Known failure modes
1. **Skipped build reusing old output**: deployment attaches to the new commit but serves the previous build byte-for-byte. Fix: deployment → ⋯ → **Redeploy** → **UNCHECK "Use existing Build Cache"**. Check Project → Settings → Git → *Ignored Build Step* if it recurs.
2. **Manual-redeploy race**: clicking "Redeploy" on the *current* production deployment (e.g. after changing an env var) rebuilds the **old commit**; if it finishes after a merge-triggered build, it takes the production alias and prod runs old code. Rule of thumb: after changing a Vercel env var around a merge, redeploy the **newest** deployment (the merge commit), not the currently-serving one.
3. **Vercel edge HTML cache**: `x-vercel-cache: HIT` with growing `age:` on the HTML is normal for a few minutes; it does NOT explain a stale bundle hash beyond that. Don't chase it first — check the deployment content (steps above).

## Verifying Cloudflare CDN caching (images)
Use **GET, not HEAD** — `curl -I` sends HEAD, which never populates Cloudflare's cache and reports `cf-cache-status: DYNAMIC` even when caching works:
```bash
URL="https://img.flyerboard.com.au/flyers/<some-key>"
curl -s -o /dev/null -D - "$URL" | grep -iE "cf-cache-status|cache-control|age:"
# run twice: expect MISS then HIT with cache-control: max-age=31536000
```
Getting a real key: list the bucket with the AWS SDK using creds from `.env.local` (`node -e` with `@aws-sdk/client-s3` `ListObjectsV2Command`, Prefix `flyers/`). The `list-bucket.mjs` script referenced in older docs does not exist.
