# Ad Posting / Edit / Delete — User Journeys

Given/When/Then map of every create, edit, and delete flow that exists in the
repo today. No speculative flows. Entry point: `src/pages/PostAdPage.tsx` →
`src/features/ads/PostAd.tsx`. Backend: `convex/posts.ts`
(`createAd` / `updateAd` / `deleteAd` / `toggleAdStatus` / `boostAd`),
`convex/upload_urls.ts` (presigned R2 upload), `src/lib/uploadToR2.ts`
(client compress + PUT), `src/components/ui/ImageUpload.tsx`.

Complements the broader `USER_JOURNEYS.md` (browse/message) — this file owns the
create/edit/delete surface. Where the two overlap, the field limits and quality
values here are authoritative (the older doc drifted: it says "description 500 /
extended 2000 / 90% quality"; the code is description 1500, exchange 500, and
adaptive 85–92% quality).

## Access & gating

### P1. Route requires authentication
**Given** an unauthenticated visitor
**When** they hit `/post`
**Then** `PostAdPage` renders `PageLoader`, and once the session resolves as
unauthenticated it `navigate('/', { replace: true })` — the form never mounts.

### P2. Session still loading
**Given** a visitor whose Descope session is still loading (`isSessionLoading`)
**When** `/post` renders
**Then** `PageLoader` is shown until the session resolves (no premature redirect).

## Create a new flyer

### P3. Post a single flyer (happy path)
**Given** an authenticated user on `/post` with title, category, description,
listing type + price (or exchange), a location picked from the dropdown, and
1–5 images that finished compressing
**When** they press "Pin Flyer"
**Then** a 3-step sequence runs: (1) `posts.createAd` inserts the ad with
`images: []`, `isActive: true`, `bumpedAt: Date.now()`; (2) each compressed WebP
is uploaded to R2 via a fresh `upload_urls.generateListingUploadUrl({ postId: adId })`
presigned PUT; (3) `posts.updateAd` patches the ad with the returned `r2:…` keys.
A success toast fires and the notification-permission modal opens; closing it
calls `onBack()` to navigate (home with `forceRefresh`, or dashboard/origin).

### P4. Required-field validation (client)
**Given** the user submits with a missing title, description, location, or
category — or a missing price when listing type is "sale"/"both"
**When** `handleSubmit` runs
**Then** a toast names the problem and submission aborts before any mutation.
The submit button is also disabled whenever `images.length === 0` or no
location is selected.

### P5. At least one image required
**Given** a filled form with zero images
**When** they submit
**Then** "Please add at least one image" toast; no ad is created.

### P6. Listing type drives price/exchange fields
**Given** the listing-type tablist (For Sale / Exchange / Both)
**When** the user selects "Exchange"
**Then** the price field is hidden and cleared; "What are you looking for?"
(exchange description, 500 chars) shows. "Both" shows price + exchange. Price is
required only for "sale"/"both", enforced client-side and again in
`createAd`/`updateAd` ("Price is required for sale listings").

### P7. Price input is whole-numbers-only
**Given** the price field
**When** the user types
**Then** only `^(0|[1-9]\d*)$` up to 999,999,999 is accepted (no decimals, no
leading zeros); other input is rejected on keystroke. Stored as a number.

### P8. Location must be chosen from the suggestion list
**Given** the location field
**When** the user types ≥2 chars
**Then** a 300ms-debounced `searchLocations` populates a dropdown; the full
postcode dataset is prefetched on focus (`fetchLocations`). Free-typed text that
doesn't match a selection leaves `formData.location` empty, shows an amber
"Please select a location from the list" hint, and keeps submit disabled.

### P9. Images compress in the background before upload
**Given** the user adds images (drag-drop or file picker, JPG/PNG/GIF/WebP/HEIC/HEIF,
≤10MB each, ≤5 total)
**When** files are added
**Then** each shows an instant data-URL preview and compresses off-thread to WebP
at adaptive quality (85–92% by network speed, ≤2048px longest side) via a Web
Worker. Only the compressed `File` is uploaded — the base64 preview is display-only
and never reaches a mutation.

### P10. Submit waits on in-flight compression
**Given** the user presses submit while some images are still `compressing`
**When** `handleSubmit` runs
**Then** an "Optimizing Images" modal shows compression progress; a 100ms poll
watches the shared `ImageState` objects until none are `compressing`, then
`performUpload` proceeds automatically.

### P11. A failed compression blocks upload
**Given** one or more images are in `error` status
**When** `performUpload` collects compressed files
**Then** "Some images failed to compress. Please remove and re-add them." toast;
the whole submit aborts (no ad created).

### P12. Upload progress overlay
**Given** an in-progress create/update
**When** images upload and mutations run
**Then** a full-screen circular-progress overlay reports "Creating flyer… /
Uploading image i/N… / Finalizing…" from 10→100%.

### P13. Switch to Moving Sale mode from the post form
**Given** the `movingSaleMode` flag is on and the user is on a *new* post (not edit)
**When** they click the "Moving Sale" card
**Then** if the form is dirty (title/description/images) a `window.confirm` warns
that entries will be discarded, then `navigate('/sell/moving-sale')`. This form
lives outside Layout, so it fully unmounts — state is intentionally lost.

### P14. Cancel abandons the form
**Given** a user mid-create
**When** they press "Cancel" or the header back arrow
**Then** `onBack("cancel")` returns them to their origin (`/ad/…` if they came
from an ad page, else dashboard/home) — no mutation runs.

## Edit an existing flyer

### P15. Edit mode pre-fills the form
**Given** the owner navigates to `/post` with `location.state.editingAd`
**When** `PostAd` mounts
**Then** all fields are pre-filled from the ad, `images` is seeded with the ad's
existing `r2:…` keys, the header reads "Edit Flyer", the submit button reads
"Update Flyer", and a Delete button appears in the header. (Access control is
server-side: `updateAd`/`deleteAd` re-check ownership — the client passes the ad
via router state.)

### P16. Update with a mix of kept and new images
**Given** the owner in edit mode who removed some existing images and/or added new ones
**When** they press "Update Flyer"
**Then** `existingImageKeys` = the ad's stored keys still present in `images`
(removed ones filtered out); new compressed files upload to R2 and yield fresh
`r2:…` keys; `updateAd` is called with `[...existingImageKeys, ...newImageKeys]`.
Only storage keys are sent — never base64/data URLs.

### P17. Removing images while editing
**Given** the owner deletes image thumbnails in the `ImageUpload` grid
**When** they save
**Then** the removed keys are excluded from `finalImages`; the R2 objects are
left in place (only purged later by `imageCleanup` if the whole ad is deleted).

### P18. Price-drop history on update
**Given** the owner lowers the price
**When** `updateAd` runs
**Then** the prior price is saved to `previousPrice` (raising the price clears it),
powering the price-drop badge on the ad.

### P19. Update ownership guard (server)
**Given** any non-owner (or unauthenticated caller) invokes `updateAd`
**When** the mutation runs
**Then** it throws "Must be logged in…" or "You can only update your own flyers"
after `getDescopeUserId` + owner comparison — before any patch.

## Delete a flyer

### P20. Soft-delete with confirmation
**Given** the owner in edit mode
**When** they click Delete and confirm in the modal
**Then** `posts.deleteAd` soft-deletes: `isDeleted: true`, `isActive: false`,
`deletedAt: Date.now()`; the ad row and its R2 images are retained (images purged
later by the retention cron). `detachAdFromBundle` runs first if the ad was in a
standalone bundle. Success toast, then `onBack("delete")`.

### P21. Delete navigation never returns to the dead ad page
**Given** a just-deleted flyer
**When** `onBack("delete")` runs
**Then** navigation goes to `/dashboard` (if that was the origin) or home with
`forceRefresh` — never back to `/ad/<id>`, which would 404.

### P22. Delete ownership guard (server)
**Given** a non-owner invokes `deleteAd`
**When** the mutation runs
**Then** it throws "You can only delete your own flyers" after auth + ownership,
before any patch. Rate-limited to 20/hour.

## Adjacent owner actions (same mutations file, not on the post form)

### P23. Toggle active/inactive
**Given** the owner (from the dashboard)
**When** they toggle a flyer's status
**Then** `posts.toggleAdStatus` flips `isActive` after auth + ownership checks.
(No rate limit on this op — see broken-flows note.)

### P24. Boost to top
**Given** the owner of an eligible active, unsold, un-bundled, non-sale flyer
**When** they boost (feature-flagged)
**Then** `posts.boostAd` re-stamps `bumpedAt` after auth, flag, ownership,
eligibility, cooldown, and per-user daily-cap checks — see `useBoostAction` and
`BoostConfirmModal`.

## Rate limits & CORS (server invariants)

- `createAd` 10/hr, `updateAd` 30/hr, `deleteAd` 20/hr (`convex/lib/rateLimit.ts`).
- `generateListingUploadUrl` / `generateProfileUploadUrl` share the
  `generateUploadUrl` limit (50/hr) and run auth + rate-limit before signing.
- Presigned PUTs set `ChecksumAlgorithm: undefined` +
  `unhoistableHeaders: new Set(["x-amz-checksum-crc32"])` — required to avoid R2
  403 CORS preflight failures. Client PUTs with `Content-Type: image/webp`.
