export const meta = {
  name: 'redesign-remaining-clusters',
  description:
    '7 parallel subagents apply the established FlyerBoard design contract to the remaining clusters (Auth, Dashboard, Posting, Modals, Static, Admin, Misc) in isolated worktrees.',
  phases: [
    { title: 'Apply design contract', detail: '7 clusters fan out in parallel git worktrees' },
  ],
};

const CONTRACT = `
DESIGN CONTRACT — apply consistently across every file you touch.

Reference patterns already live in the codebase from completed batches.
READ THESE FIRST so you can copy exact class strings:

  src/index.css                                        — tokens, .kicker, .tabular, .hairline, .listing-card
  tailwind.config.js                                   — font-display, shadow-card, shadow-card-hover
  src/features/layout/HeaderRightActions.tsx           — primary CTA + ghost CTA pattern
  src/features/layout/Header.tsx                       — pill search input pattern
  src/features/layout/Sidebar/SidebarContent.tsx       — kicker label + left-edge accent active state
  src/features/ads/AdsGrid.tsx                         — listing card with ring + tinted shadow + motion entry
  src/features/ads/AdDetail.tsx                        — title/price hero, section labels, ghost-pill buttons, modal-style FABs

TOKENS (already wired — do NOT modify index.css or tailwind.config.js):
  bg-background       warm cream (light) / warm off-black (dark)
  bg-card             slightly lighter cream surface
  --shadow-color      warm-tinted (12 35% 22%) — used by shadow-card, shadow-card-hover
  font-display        Fraunces (serif) — for hero headings + prices
  font-sans           Plus Jakarta Sans — body (default)
  .kicker             small-caps 11px tracked uppercase label (use for in-card section headings)
  .tabular            font-variant-numeric: tabular-nums (for prices, counts, dates, IDs)
  .hairline           1px warm divider

CARD SURFACE (REQUIRED — replace every generic card with this):
  bg-card ring-1 ring-border/70 rounded-2xl shadow-card
  NEVER: border border-border rounded-lg shadow-sm
  NEVER: rounded-md/rounded-lg + flat shadow + plain border for major cards

BUTTONS (REQUIRED):
  Primary CTA:
    bg-primary text-primary-foreground h-11 px-4 rounded-full
    hover:bg-primary/90 active:scale-[0.98] transition-all
    font-semibold shadow-sm shadow-primary/25
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
    focus-visible:ring-offset-2 focus-visible:ring-offset-background
  Ghost / Secondary:
    bg-muted/40 text-foreground ring-1 ring-border
    hover:bg-muted/70 hover:ring-foreground/15
    active:scale-[0.98] rounded-full font-medium
  Outline (e.g. Rate, Cancel):
    bg-transparent text-primary ring-1 ring-primary/40
    hover:ring-primary hover:bg-primary/[0.06] rounded-full
  Icon-only round:
    w-10 h-10 rounded-full hover:bg-muted/60 text-muted-foreground
    hover:text-foreground transition-colors

INPUTS (REQUIRED — pill style):
  h-10 or h-11, px-4 (or pl-10 with leading Lucide icon)
  bg-muted/50 rounded-full ring-1 ring-transparent
  focus:ring-ring focus:bg-card focus:outline-none transition-all
  placeholder:text-muted-foreground/70 text-foreground

TEXTAREAS / multi-line fields:
  rounded-2xl (not full), bg-muted/50, ring-1 ring-transparent,
  focus:ring-ring focus:bg-card

MODAL / DIALOG (REQUIRED):
  Backdrop:  fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm
             (do NOT use bg-black/60 or pure black)
  Sheet:     bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover
             (do NOT use border border-border + shadow-2xl)
  Close X:   text-muted-foreground hover:text-foreground rounded-full p-2
             hover:bg-muted/60 transition-colors
  Headers:   <h2 className="font-display text-2xl font-semibold tracking-tight"> for title,
             <h3 className="kicker"> for section labels

TYPOGRAPHY:
  Hero h1:     font-display text-3xl sm:text-4xl font-semibold
               tracking-[-0.02em] leading-[1.05]
  Sub h2:      font-display text-xl sm:text-2xl font-semibold tracking-tight
  Section h3:  <h3 className="kicker mb-3 sm:mb-4">...</h3>
  Body:        text-[15px] leading-relaxed text-foreground/80
               (for long-form copy)
  Prose:       max-w-prose for paragraph blocks
  Prices/nums: font-display font-semibold tabular

COLOR + LEGACY CLEANUP:
  text-primary-bright on light surfaces  → text-primary
  bg-primary text-white                  → bg-primary text-primary-foreground
  border-neutral-200, border-neutral-300 → border-border
  text-neutral-500 / text-neutral-600    → text-muted-foreground
  bg-neutral-50 / bg-white               → bg-card or bg-background as appropriate
  border-2 (anywhere)                    → ring-2 (or 1 if subtler)

MOTION:
  framer-motion is installed. Use sparingly:
    - Entry stagger on lists of cards (cap at first 18 items)
    - active:scale-[0.98] on every tap target
    - 200–300ms duration, cubic-bezier(0.2,0.8,0.2,1) easing
  Do not animate every element. Pick the moments.

SEMANTIC HTML (REQUIRED while you're touching JSX):
  Replace generic <div> wrappers with <section>, <article>, <nav>,
  <aside>, <header>, <main> where the meaning fits.
  Every interactive element needs an accessible name (aria-label or
  visible text).
  Every form input needs an associated <label> or aria-label.
  Use <button type="button"> explicitly for non-submit buttons inside forms.

DO NOT TOUCH:
  - Test-pinned strings — BEFORE you change any literal text in a file,
    grep the corresponding *.test.tsx and the e2e/ directory for that
    string. If a test asserts on it, keep it VERBATIM.
  - Convex queries, mutations, args, return shapes.
  - Routing, useNavigate calls, Link destinations.
  - Component prop signatures or exports.
  - Existing aria attributes (only ADD where missing).
  - Image sources or upload logic.
  - Auth flows / Descope logic.
`;

const CLUSTERS = [
  {
    key: 'auth',
    label: 'Auth',
    branchSuffix: 'auth',
    files: [
      'src/features/auth/AuthModal.tsx',
      'src/features/auth/SignInForm.tsx',
      'src/features/auth/SmsOtpSignIn.tsx',
    ],
    extras: `
Auth flow notes:
  - AuthModal is the wrapper portal. Its backdrop is currently bg-black/60 —
    replace with bg-foreground/40 backdrop-blur-sm. Sheet should be card +
    ring + shadow-card-hover.
  - SignInForm has Descope sign-in / sign-up UI; lots of small text links
    that use text-primary-bright. Replace with text-primary, ensure proper
    underline behavior on hover.
  - SmsOtpSignIn has a multi-step OTP flow (request code → enter code →
    success). Each state should use the same card/heading/input pattern.
    Number inputs for OTP should use .tabular.`,
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    branchSuffix: 'dashboard',
    files: [
      'src/features/dashboard/UserDashboard.tsx',
      'src/pages/DashboardPage.tsx',
      'src/features/ads/AdMessages.tsx',
    ],
    extras: `
Dashboard notes:
  - UserDashboard is ~1100 lines; do targeted Edit calls, NOT a full Write.
    Tabs (My Flyers / Saved / Chats / etc.) — refine the tab bar with the
    sidebar's active-state pattern (left or bottom accent, depending on
    orientation). Each tab card list should reuse the listing card pattern
    from AdsGrid (ring + shadow-card).
  - Empty states ("No saved flyers yet" etc.) — use the same composition
    as AdsGrid's "No Flyers Found" empty state.
  - AdMessages is the conversation list; treat each conversation row as a
    list item with ring-bottom hairline divider rather than card-per-row.
    Active conversation gets bg-muted/50 + ring or edge accent.`,
  },
  {
    key: 'posting',
    label: 'Posting',
    branchSuffix: 'posting',
    files: [
      'src/features/ads/PostAd.tsx',
      'src/pages/PostAdPage.tsx',
    ],
    extras: `
Posting notes:
  - PostAd is the create/edit-a-flyer form. Group it into editorial sections
    with kicker labels ("Basics", "Pricing", "Photos", "Location") and a
    hairline divider between sections inside one card container.
  - Listing type selector (sale / exchange / both) — use a segmented pill
    pattern: a single rounded-full container with three buttons; active
    button bg-card + ring-1 ring-primary/40 + text-primary; inactive
    text-muted-foreground.
  - Image upload area — refined dashed-ring drop zone: rounded-2xl,
    ring-1 ring-dashed ring-border/80, bg-muted/30, hover bg-muted/50.
  - Submit button is the page's primary CTA — use the contract primary
    pattern at h-12 instead of h-11 for prominence.`,
  },
  {
    key: 'modals',
    label: 'Shared modals',
    branchSuffix: 'modals',
    files: [
      'src/components/RatingModal.tsx',
      'src/components/ReportModal.tsx',
      'src/components/ReviewListModal.tsx',
      'src/components/notifications/ContextualNotificationModal.tsx',
      'src/components/notifications/NotificationPrompt.tsx',
    ],
    extras: `
Modals notes:
  - All five are dialog/modal shells with different content. Apply the
    contract's modal pattern uniformly: backdrop bg-foreground/40 +
    backdrop-blur-sm, sheet bg-card ring-1 ring-border/70 rounded-2xl
    shadow-card-hover.
  - Modal headers: <h2 className="font-display text-2xl font-semibold
    tracking-tight"> with optional kicker above.
  - Star inputs in RatingModal — keep the existing component, but
    refine spacing and label hierarchy.
  - ReviewListModal contains a scrollable list; each review uses
    hairline dividers, not cards.`,
  },
  {
    key: 'static',
    label: 'Static pages',
    branchSuffix: 'static',
    files: [
      'src/pages/AboutUsPage.tsx',
      'src/pages/CommunityGuidelinesPage.tsx',
      'src/pages/TermsPage.tsx',
      'src/pages/SupportPage.tsx',
      'src/components/MarkdownContent.tsx',
    ],
    extras: `
Static pages notes:
  - These are long-form content pages. Wrap content in
    <article className="prose-like content-width-reading mx-auto">.
  - Replace generic h1/h2 with font-display + tracking-tight scale:
    h1 text-4xl sm:text-5xl font-semibold leading-[1.05]
    h2 text-2xl sm:text-3xl font-semibold tracking-tight mt-12 mb-4
    h3 text-xl font-semibold tracking-tight mt-8 mb-3
  - Body paragraphs: text-[15px] leading-relaxed text-foreground/80
    max-w-prose.
  - Bullet lists: use space-y-2, marker-text-primary or a custom marker.
  - MarkdownContent renders user-supplied markdown; apply the same prose
    treatment so the in-app markdown matches the static pages.
  - SupportPage has contact links — refine the link block as a card with
    pill CTAs.`,
  },
  {
    key: 'admin',
    label: 'Admin',
    branchSuffix: 'admin',
    files: [
      'src/features/admin/AdminDashboard.tsx',
      'src/features/admin/FlyersTab.tsx',
      'src/features/admin/CategoriesTab.tsx',
      'src/features/admin/UsersTab.tsx',
      'src/features/admin/ReportsTab.tsx',
      'src/features/admin/ChatsTab.tsx',
      'src/features/admin/FeatureFlagsTab.tsx',
      'src/pages/AdminDashboardPage.tsx',
    ],
    extras: `
Admin notes:
  - Admin is data-dense. Tab bar at the top uses kicker labels with a
    bottom-edge primary accent for the active tab (1.5px height,
    full width of the tab cell).
  - Tables: refined column headers (kicker style), row hover bg-muted/40,
    no per-row borders — use a single border-b border-border/60 between
    rows. Numeric/date columns should use .tabular.
  - Action buttons in row cells: small ghost pills, h-8 instead of h-11.
  - Status badges (active / pending / banned): use ring-1 chips, e.g.
    inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
    font-semibold tracking-wide uppercase ring-1, color varied by status.
  - Filters and search inputs at the top of each tab: pill inputs from
    the contract.`,
  },
  {
    key: 'misc',
    label: 'Misc shared',
    branchSuffix: 'misc',
    files: [
      'src/components/ui/ErrorFallback.tsx',
      'src/components/ui/DashboardSkeleton.tsx',
      'src/components/ThemeToggle.tsx',
      'src/components/ui/LucideIconPicker.tsx',
      'src/pages/AdDetailPage.tsx',
      'src/features/layout/Layout.tsx',
    ],
    extras: `
Misc notes:
  - AdDetailPage hosts an auth modal portal (currently bg-black/60 +
    border border-border + shadow-2xl). Update to the contract's modal
    backdrop + sheet pattern.
  - ErrorFallback: use the contract's card surface + font-display heading
    + primary CTA for "Try again".
  - DashboardSkeleton: align the skeleton boxes to the new card pattern
    (ring + shadow-card outline; shimmer blocks for content).
  - ThemeToggle: refine the icon-only round button to match the contract
    icon-only pattern.
  - LucideIconPicker: grid of icon buttons — apply ring-based active
    state instead of border-based.
  - Layout.tsx: this is the route shell. Only style changes (no logic).
    If it currently uses bg-white or bg-neutral-* — switch to bg-background.`,
  },
];

function buildPrompt(cluster) {
  return `You are a senior frontend designer working in a fresh git worktree of the
FlyerBoard React + Tailwind v4 codebase. Your job is to apply the design
contract below to a single cluster of files, then commit.

You are running on its own branch already (the worktree's branch); do not
switch branches. The repository root is your current working directory.

CLUSTER: ${cluster.label}

FILES IN YOUR SCOPE (touch ONLY these — do not modify anything else):
${cluster.files.map(f => `  - ${f}`).join('\n')}
${cluster.extras}

${CONTRACT}

PROCESS:
1. Read the reference files listed at the top of the contract. Internalize
   the patterns so you can apply them consistently.
2. For each file in your scope:
   a. Read it fully.
   b. Grep the corresponding *.test.tsx (and e2e/) for any strings the
      tests assert on. List those strings mentally and preserve them.
   c. Identify generic AI patterns and replace with contract patterns:
        - border border-border + rounded-lg + shadow-sm  → ring-1 ring-border/70 + rounded-2xl + shadow-card
        - bg-primary text-white                          → bg-primary text-primary-foreground (+ rounded-full + active:scale)
        - text-primary-bright on light surfaces          → text-primary
        - bg-black/60 modal backdrops                    → bg-foreground/40 backdrop-blur-sm
        - text-2xl font-bold heroes                      → font-display + tighter tracking
        - generic section heads (text-lg font-semibold)  → <h3 className="kicker">
        - border-2 / border-neutral-200                  → ring-2 / border-border
        - rounded-lg pills                                → rounded-full pills
        - py-3 px-4 form buttons                          → h-11 + rounded-full
   d. Make targeted Edit calls. Prefer many small Edits over one big
      Write — keeps diffs reviewable.
   e. Add semantic HTML where appropriate (article/section/nav/aside).
   f. Add aria-label to any interactive element that lacks an accessible name.
3. After editing all your files, verify before committing:
     npx tsc -p . --noEmit --pretty false
   If anything fails, fix it. Then:
     npx vitest run
   If any test fails because of a string change you made, REVERT that
   string back to the test-pinned value. Visual changes must not break tests.
4. Commit ALL your changes on the worktree's current branch with this
   exact format:
     git add -A
     git commit -m "Redesign ${cluster.key} cluster — design-contract pass"
5. Confirm the commit:
     git rev-parse HEAD          (record this SHA)
     git branch --show-current   (record this branch)

RULES:
- No new dependencies. No new files unless absolutely required.
- No logic refactors. CSS / JSX structure / aria only.
- If a file in your scope is already fully on-contract, skip it and note that.
- If you discover a file that needs changes but is OUTSIDE your scope,
  note it in your return — do NOT edit it.
- Keep commit atomic — one commit per cluster.

RETURN the structured object: cluster, files_changed (paths that were
actually edited), commit_sha, branch, tests_passed, build_passed (set
true only if you ran tsc and it was clean), notes (1-3 sentences:
what visual changes you made, any test-pinned strings preserved, any
files you found already on-contract).`;
}

const RESULT_SCHEMA = {
  type: 'object',
  required: ['cluster', 'files_changed', 'commit_sha', 'branch', 'tests_passed', 'build_passed', 'notes'],
  additionalProperties: false,
  properties: {
    cluster: { type: 'string' },
    files_changed: { type: 'array', items: { type: 'string' } },
    commit_sha: { type: 'string' },
    branch: { type: 'string' },
    tests_passed: { type: 'boolean' },
    build_passed: { type: 'boolean' },
    notes: { type: 'string' },
  },
};

phase('Apply design contract');

log(`Fanning out ${CLUSTERS.length} subagents in isolated worktrees…`);

const results = await parallel(
  CLUSTERS.map(c => () =>
    agent(buildPrompt(c), {
      label: `redesign:${c.key}`,
      isolation: 'worktree',
      schema: RESULT_SCHEMA,
    })
  )
);

const ok = results.filter(Boolean);
const failed = CLUSTERS.length - ok.length;
log(`Completed: ${ok.length}/${CLUSTERS.length} clusters. ${failed} failed/skipped.`);

return { results: ok, failed };
