# Table Viewer layout + information architecture (proposal)

Date: 2025-12-31

## Goals

1. **Stable geometry**: avoid horizontal “jumping” when the round changes (preflop→flop→turn→river→showdown) or when values appear/disappear (e.g., current bet).
2. **Intelligent use of space**: show the most relevant shared/public table information first.
3. **Single player list**: one list that adapts across the hand; no separate “Showdown” section duplicating player display.
4. **Showdown clarity**: winners + *winning hand rank* (e.g., “Flush”, “Two Pair”) are visible on the common display.
5. **Room code de-emphasis**: still present, but not the largest element on the page.

Non-goals (for now): table-seat circular layout, animations, advanced filtering, per-street hand history UI.

## Current pain points (observed)

- The header reflows as elements appear/disappear (notably the conditional "Current Bet" panel). This can change line breaks and perceived width.
- At showdown the UI renders a dedicated "Showdown" grid *and* keeps the regular players grid, creating duplication.
- Room code is currently the largest typographic element, competing with the poker state.

## Proposed layout (single-screen)

Overall structure: **one fixed-width main column** with two zones:

- **Top (table info)**: compact header + pot/round/turn summary + community cards.
- **Bottom (players)**: vertical list of players, top-to-bottom.

### 1) Page container: lock widths and reduce reflow

- Use a single centered container with a consistent max width (example: `maxWidth: 1100–1200px`) and `width: 100%`.
- Avoid conditional rendering that changes layout width. Prefer rendering placeholders with fixed dimensions.

**Rule:** if a panel might disappear (current bet, side pot details), it still renders but shows `—` / muted style.

### 2) Header: compact, consistent grid

Replace the current large “Room: XXXX” title with a compact header bar.

**Header row (single line, stable):**
- Left: `Room XXXX` (small/medium text)
- Center: `Round: <street>`
- Right: `Players in: A/B`

Optional: show game status (“waiting”, “active”, “completed”) as small badge.

### 3) Table summary row (always the same columns)

Second row: a fixed grid with 3–4 equal-width panels. Always present.

Suggested panels:
1. **Pot**: `Total: $N` and (if multiple pots) a compact stacked line list with fixed max height.
2. **Current bet**: always shown; when `0` show `Current bet: —`.
3. **To act**: `Turn: <player name>` when active; otherwise `Turn: —`.
4. (Optional) **Dealer**: dealer name or position icon.

This replaces the current behavior where “Current Bet” appears only sometimes.

### 4) Community cards: fixed 5-card strip (already mostly correct)

Keep the 5-slot layout (this is the right approach for stable width).

Adjustments to ensure stability:
- Keep card slots at fixed width/height and center them.
- Ensure the placeholder is the same size as a face-up card.
- Avoid any text below the board that appears/disappears in a way that changes vertical spacing; reserve a fixed-height “status line” under the board.

### 5) Players list: single vertical list (top-to-bottom)

Replace the current auto-fit card grid with a single-column list.

Each player row is a fixed-height-ish “strip” with consistent columns:

**Columns** (left → right):
- **Identity**: dealer marker + player name (truncate if needed)
- **Stack**: chips
- **In-front**: current bet (always shown; `—` if zero)
- **Action/Status**: last action or folded/all-in/in-hand/turn
- **Cards**: two card slots

This design uses space efficiently and reads well from across a room.

### 6) Showdown behavior: same list, richer card column

At showdown, do NOT render a separate showdown section.

Instead, the player rows adapt:

- Players who are eligible to show (still in the hand / not folded) display their actual hole cards.
- Folded/out players keep placeholders or show “Folded” in status; no hole cards.
- Winners get a highlight (existing gold border concept is fine).

### 7) Winning hand rank display (main + side pots)

At showdown, show the winning rank for **each pot** (main pot and any side pots).

**Minimum requirement (meets request):**
- In the table summary row, render a compact list:
  - `Main: <rank> — <winner names>`
  - `Side 1: <rank> — <winner names>`
  - `Side 2: ...`

Notes:
- If a pot is split (multiple winners), that’s already represented by multiple winner names; the rank stays a single value (the best hand that won that pot).
- If a hand ends by everyone folding (no true showdown evaluation), show something like `Won by fold` instead of a poker rank.

### 8) Side pots + winners (common display)

Because this is a public display, the minimum needed is:
- Total pot
- If multiple pots: “Main / Side 1 / Side 2…” with amount and eligible player count
- At showdown: show which winners correspond to which pot (optional, but useful)

**Decision:** keep side pot details compact; avoid expanding the header vertically mid-hand.

## Data / API requirements

Today, `TableView` has:
- `game.winners?: number[]` (positions)
- `game.pots?: { amount, eligiblePlayers, winners? }[]`
- `players[].holeCards?` (present at showdown)

To show the *winning hand rank per pot*, we need one of these:

### Option A (preferred): server provides showdown evaluation results (rank names)

Extend the game state shape so each pot includes a displayable winning rank name:

- `pots?: Array<{
    amount: number;
    eligiblePlayers: number[];
    winners?: number[];
    winningRankName?: string; // e.g. "Flush", "Two Pair", "Royal Flush", "Won by fold"
  }>`

Then TableView can render:
- a stable “Pots” panel that lists `Main/Side N`, amount, winners, and `winningRankName`.

This keeps *all* evaluation logic on the backend (single source of truth) and avoids frontend duplication.

### Option B: shared evaluator code via `@scaffold/shared`

If we want true reuse, we can move the hand-evaluation logic into `@scaffold/shared` and import it from backend + (optionally) frontend.

However, even with a shared evaluator, the frontend still should not *need* to evaluate hands to display the common screen. The cleanest approach remains:
- backend evaluates once
- backend returns `winningRankName` per pot
- frontend just renders

Where `@scaffold/shared` *does* help immediately is shared contracts:
- shared TypeScript types for `GameState`, `Pot`, `ShowdownPotResult`
- shared formatting helpers (e.g., mapping rank identifiers to short labels, if we ever standardize rank IDs)

Note: today `@scaffold/shared` is very small and the backend is CommonJS while the shared package is ESM; any plan to share runtime evaluator code should account for module-format interop.

## Rendering rules (to prevent “dizzy” layout changes)

1. **Never conditionally remove panels** that affect width. Render them disabled/muted instead.
2. **Fixed board slots**: always 5, always same size.
3. **Single players list**: no separate showdown grid.
4. **Reserve space** for small per-round messages (“Pre-flop betting…”) via a fixed-height line.

## Visual hierarchy (what should pop)

1. Community cards (largest)
2. Pot + current bet + turn indicator (medium)
3. Player list (medium, dense)
4. Room code (small)

## Implementation sketch (frontend-only)

- Refactor [frontend/src/pages/TableView.tsx](frontend/src/pages/TableView.tsx) into three sub-sections in the JSX:
  - HeaderBar
  - TableSummary
  - CommunityBoard
  - PlayerList (single list)

Even if we keep inline styles initially, ensure the layout uses stable grids and consistent min widths.

## Open questions (to decide together)

1. **Who is “Players In”?** Currently it filters `status !== folded && status !== out`. Should “all_in” count? (I think yes.)
2. **What do we show for folded players’ cards at showdown?** Usually still hidden; keep hidden.
3. **Multi-pot winners:** do we show per-pot winners + rank, or only the overall/main pot winner rank?
4. **Turn indicator:** show player name (best) or just position?

## Success criteria

- Going from preflop→flop does not change the horizontal footprint of the board/header.
- At showdown, there is only one place to look for player hole cards.
- Winning hand rank is visible on the table display at showdown.
- Room code is readable but not the primary headline.
