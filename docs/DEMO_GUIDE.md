# Demonstration guide

## Start and seed

1. Copy `.env.example` to `.env`, then run `docker compose up --build`.
2. Open `http://localhost:3000`.
3. Load the deterministic fictional campus dataset with `docker compose exec web npm run db:seed`. The seed command refuses nonempty memory tables.

## A — Capture and workspace

1. Open **Quick capture**, write a note, and save. The event time defaults to now; strength update time remains separate.
2. Pin it as important and mark it sensitive to compare those controls with recall strength.
3. Add a Person or Project context. Open its context link to see its history/resume summary.
4. Use the generated bookmarklet from another page; it stages the selected page text in the capture form before save.

## B — Follow-ups, decisions, attachments

1. Open a memory detail and add a dated follow-up; complete and reopen it to demonstrate its state.
2. Add a decision with a rationale and revisit date.
3. Upload a plain text or Markdown attachment, then use the memory library’s search to find its indexed text. Binary files can be downloaded; PDF/OCR extraction is not implemented.

## C — Spatial Memory Walk and place recall

1. Open **Spatial walk**. Click at least two points around the fictional campus route, choose a corridor radius, and run the search.
2. Verify results are ordered by route position and show distance, event time, context, and strength.
3. Open **Settings → Map tile source** to configure an XYZ tile service such as `http://localhost:8080/tiles/{z}/{x}/{y}.png`. It is browser-local. The default OpenStreetMap tiles need internet.
4. Open **What’s nearby?** and explicitly click its location action. The browser asks permission at that moment; the database uses PostGIS meter distances. No location polling occurs in the background.

## D — Temporal decay and reinforcement

1. Open **Timeline**, select a memory, and run the controlled decay action.
2. Inspect the new strength and `last_strength_at`; compare those with the episode’s `occurred_at`.
3. Reinforce the memory. The database records the before/after values and event type.
4. Verify the scheduled jobs with `docker compose exec db psql -U memoryscape -d memoryscape -c "SELECT jobname,schedule,command FROM cron.job;"`.

## E — Seed-centered associative recall

1. Open **Associative graph**, choose a seed from the recent memory list, choose depth 1–3 and a pruning threshold, then explore.
2. Observe the bounded graph and the ranked strongest-path explanations (edge types, weights, valence, and target strength).
3. Click a recalled node to recenter the SQL traversal. The database prevents cycles, excludes sensitive/archived memories, caps outgoing traversal candidates, and limits returned nodes.

## F — Weekly and fading review

1. Open **Weekly review** and use Keep, Snooze, Archive, or Dismiss. These decisions persist. Sensitive and archived memories are excluded.
2. Open **Fading memories** to inspect the materialized-view refresh time. Reinforce a memory, then use the refresh action where enabled to update its snapshot ranking.

## G — Backup and restore

1. Open **Settings → Backup & restore** and download a versioned JSON backup.
2. Choose the file and click **Preview restore**. Confirm the counts before clicking **Restore these records**.
3. Restore is additive and refuses existing IDs or context labels. It uses one database transaction; if a row fails, all imported rows roll back. Backup files include sensitive content and attachment bytes; keep them private.

## H — Performance evaluation

1. Run `docker compose exec web npm run db:benchmark` to capture correctness and actual execution plans/timings under `docs/evaluation/`.
2. Use `npm run db:benchmark:fresh-buffers` only with its disposable local test database; it restarts PostgreSQL between trials but cannot flush the operating-system cache.
3. Never present the one-host results as general performance or cognitive-validity claims. See [methodology](evaluation/METHODOLOGY.md), [results](evaluation/RESULTS.md), and [implementation status](IMPLEMENTATION_STATUS.md).

## Local operation and privacy

Compose binds application and database ports to localhost. The project’s open local mode is not suitable for untrusted networks; configure its optional password authentication before any non-local exposure. The app does not upload memory contents to an external service. Map tile requests go to the configured tile provider and may disclose the viewed map area to that provider.

## I — Offline capture and daily brief

1. Open **Quick capture** once while online so the service worker can cache the capture shell.
2. Turn the browser offline, save a nonsensitive note, then reconnect. Confirm the queue syncs and the note appears once in the memory library.
3. Mark a memory sensitive and verify an offline save is refused.
4. Open **Daily brief** to inspect follow-ups due within 24 hours, decisions due for revisit, and the fading-memory snapshot.
5. Enable notifications only if desired. They are checked while the daily page is open; no notification is sent after closing the browser.

## J — Import archive files

1. Open **Settings → Import** and choose Markdown/text, a Netscape bookmark export, or an iCalendar file.
2. Preview parsed titles, dates, and content. Repeat a preview to see content duplicates identified.
3. Apply the import and confirm new rows appear in the library. Malformed files reject the whole batch before any write.

## K — Encrypted backup portability

1. Open **Settings → Backup & restore**, enter and confirm a passphrase of at least 12 characters, and download the encrypted file.
2. Select an encrypted backup, enter the passphrase, preview restore counts, and explicitly apply the restore.
3. A wrong passphrase or modified ciphertext fails locally before the server receives restore data. The passphrase is unrecoverable if lost.

## L — Context cleanup and saved searches

1. On a context workspace, add an alternate name; use that alias when linking another memory and confirm it resolves to the canonical context.
2. Merge a same-type context into another; inspect moved links and aliases. Cross-type merge is rejected, and merge does not change memory strength.
3. In the memory library, set filters, name the search, save it, then select and apply it later. Delete it when no longer useful.
