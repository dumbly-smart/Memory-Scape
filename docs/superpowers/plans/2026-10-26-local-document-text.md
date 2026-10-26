# Local PDF Text Extraction Implementation Plan

> **For agentic workers:** Execute inline task-by-task. Steps use checkbox syntax.

**Goal:** Make embedded-text and scanned PDFs searchable through local attachment extraction.

**Architecture:** A server-side attachment helper calls Poppler and Tesseract using shell-free child processes in a temporary directory. It enforces page, output, and timeout bounds; extracted text continues to use the existing PostgreSQL full-text search column.

**Tech Stack:** Next.js route handlers, Node.js, Poppler, Tesseract, PostgreSQL, Vitest, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-26-local-document-text-design.md`

## Global Constraints

- File upload remains limited to 10 MiB.
- Document bytes remain local; no remote extraction service is used.
- Text extraction is limited to 100 pages; OCR is limited to the first 10 pages and each rendered page is capped at 1,600 pixels per side.
- Child processes use fixed argument arrays, bounded execution, and temporary files that are always removed.
- Failed or unavailable extraction does not discard the attachment.

## Review Focus

- Malformed PDFs must not become searchable arbitrary binary text.
- Large or many-page PDFs must not cause unbounded rendering or output allocation.
- Missing extraction executables must not break attachment upload or download.
- Scanned page OCR must remain searchable through the existing database query path.
- Shell metacharacters in filenames must not affect child-process arguments.

---

### Task 1: PDF extraction behavior

**Files:** Modify `lib/attachments.ts`; add tests and small PDF fixtures under `tests/fixtures/`.

- [x] Test embedded PDF text, scanned PDF OCR, malformed PDF fallback, and plain text extraction against real helper behavior.
- [x] Run those tests and observe the missing PDF extraction behavior.
- [x] Implement bounded Poppler/Tesseract extraction with safe temp-file cleanup.
- [x] Run focused unit tests and the full Vitest suite.

### Task 2: Upload feedback and deployment

**Files:** Modify attachment API/UI, `docker/web.Dockerfile`, Playwright tests, demo guide, and implementation status.

- [x] Add browser contract for uploading/searching a text-layer PDF and an OCR-only PDF.
- [x] Run the browser contract and observe PDF content is currently not indexed.
- [x] Return attachment searchability in API rows and show clear indexed/no-text feedback in the attachment panel.
- [x] Install Poppler/Tesseract in the runtime image; preserve graceful upload behavior when tools are unavailable.
- [x] Update local prerequisites and run tests, typecheck, build, Compose health, and browser tests.

### Task 3: Final verification and delivery

- [x] Run `git diff --check`, review changed files, commit the feature in a focused commit, and push `main`.
- [x] Record only verified feature status and mention OCR page limits.
