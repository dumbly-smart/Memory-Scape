# Demonstration guide

## Start and seed

1. Copy `.env.example` to `.env`, then run `docker compose up --build`.
2. Open `http://localhost:3000`.
3. Load the deterministic fictional campus dataset with `docker compose exec web npm run db:seed`. The seed command refuses nonempty memory tables.

### Student-life dataset

To explore a richer fictional timeline alongside existing data, run `docker compose exec web npm run db:seed:persona`. It adds the VIT Vellore–Kannur student profile to a nonempty database and is safe to rerun. Filter the Memory Library for **Synthetic persona: Nikhil P. (fictional)**. Use the Map for VIT/Kannur and travel clusters, the Timeline for semester/holiday contrasts, and the Graph to follow project, family and friendship associations. See the [persona dataset guide](SYNTHETIC_PERSONA_DATASET.md) for reproducibility, privacy, and scoped removal.

## A — Capture and workspace

1. Open **Quick capture**, write a note, and save. The event time defaults to now; strength update time remains separate.
2. Pin it as important and mark it sensitive to compare those controls with recall strength.
3. Add a Person or Project context. Open its context link to see its history/resume summary.
4. Use the generated bookmarklet from another page; it stages the selected page text in the capture form before save.

## B — Follow-ups, decisions, attachments

1. Open a memory detail and add a dated follow-up; complete and reopen it to demonstrate its state.
2. Add a decision with a rationale and revisit date.
3. Upload a plain text or Markdown attachment, then use the memory library’s search to find its indexed text. Upload a text-layer PDF and search its contents; then upload a scanned PDF and search OCR text from its first 10 pages. Upload PNG and JPEG photos up to 12 megapixels and search their OCR text too. The attachment list reports whether searchable text was indexed. Extraction runs locally in the web container; unsupported or oversized images remain downloadable without being indexed.

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
4. Under a target, choose **Inspect alternate paths** to compare the top simple SQL paths, scores at each hop, and edge evidence.

## O — Spatiotemporal route recall

1. Open **Spatiotemporal recall**. Draw at least two points on the map.
2. Select the corridor radius and event-time interval. The start time is included and the end time is excluded.
3. Run the query and inspect the results ordered along the route. The database intersects PostGIS geography distance with event time.

## P — Research evaluation

1. Apply migrations, then run `DATABASE_URL=... npm run test:research-db` for the rollback-only SQL contracts.
2. Run `DATABASE_URL=... npm run research:evaluate -- --seed=497`.
3. Inspect `docs/evaluation/research/RESULTS.md` and `RESULTS.json` for measured ablations, calibration, corridor radius sensitivity, and robustness scenarios.
4. Repeat with another fixture seed or `RESEARCH_REPETITIONS=...`. The runner rolls back all fixture changes and checks that persistent row counts remain unchanged.

These parameter results use a small synthetic ground-truth graph only; they do not show biological calibration or human recall validity.

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
5. Enable in-page notifications if desired, or opt into background reminders. The latter registers a Web Push subscription for due follow-ups and decision revisits; browser push services must be reachable.

## J — Import archive files

1. Open **Settings → Import** and choose Markdown/text, a Netscape bookmark export, or an iCalendar file.
2. Preview parsed titles, dates, and content. Recurring events expand; finite RRULE series are capped at 1,000 instances, while open-ended series cover the one-year-before/after import window. Repeat a preview to see duplicates identified.
3. Apply the import and confirm new rows appear in the library. Malformed or oversized batches reject before any write.

## K — Encrypted backup portability

1. Open **Settings → Backup & restore**, enter and confirm a passphrase of at least 12 characters, and download the encrypted file.
2. Copy and store the one-time recovery key separately from the file. It appears only on the page after export and is not stored by MemoryScape.
3. Select an encrypted backup, unlock using either the passphrase or recovery key, preview restore counts, and explicitly apply the restore. A wrong key or modified ciphertext fails locally before the server receives restore data.

## L — Context cleanup and saved searches

1. On a context workspace, add an alternate name; use that alias when linking another memory and confirm it resolves to the canonical context.
2. Merge a same-type context into another; inspect moved links and aliases. Cross-type merge is rejected, and merge does not change memory strength.
3. In the memory library, set filters, name the search, save it, then select and apply it later. Delete it when no longer useful.

## M — Offline encrypted capture

1. Open `/capture`, enter a local queue passphrase of at least 12 characters, and write a note.
2. Disconnect the browser in developer tools, save the note, and inspect the `memoryscape-offline-capture` IndexedDB object store. Stored records contain ciphertext and no note content.
3. Reconnect, enter the same passphrase, and choose **Sync encrypted drafts**. Try an incorrect passphrase first; it must leave the queue untouched.

## N — Background reminders

1. Open `/daily` in a browser that supports service workers and Push API, then choose **Enable background reminders** and grant notification permission.
2. PostgreSQL stores the browser subscription and generated VAPID keys. Keep the server and its database running; the Node scheduler checks due items every minute.
3. Create a due follow-up or decision, close the page, and wait for the browser push service. Sensitive and archived linked memories are excluded. Disable reminders on `/daily` to revoke the subscription.

## Q — Current-location Memory Walk

1. Open **Spatial walk** and allow location access. The map centers on the browser's current position and shows a location marker. If permission is denied, use the map manually; it opens near VIT Vellore.
2. Set the corridor radius, then choose **Start route at my location** to add the current position as the first route point. Add further points on the map to draw the walk, or start by clicking the map when location is unavailable.
3. Run **Walk this route**. PostgreSQL performs the PostGIS corridor filter and orders results along the route. Select a result to inspect it and use the previous/next controls for sequential recall.

## R — One-card Weekly Review

1. Open **Weekly review**. Only the active memory is shown; the progress counter tracks the remaining session.
2. Swipe right to **Keep**, or swipe left to **Archive**. Archive is recoverable, not permanent deletion. The handled card leaves the queue and the next card becomes active.
3. Use the visible action buttons as an alternative to swiping: **Keep**, **Snooze**, **Archive**, or **Dismiss**. Each decision removes that card from the current session.
