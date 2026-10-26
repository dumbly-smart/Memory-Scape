# Image Attachment OCR Implementation Plan

> **For agentic workers:** Execute inline task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** OCR PNG and JPEG attachments locally so their text participates in ordinary memory search.

**Architecture:** Validate raster signatures and dimensions in the attachment helper, then invoke the installed Tesseract binary with a fixed argument list. The existing extracted-text database field and PostgreSQL search path remain unchanged.

**Tech Stack:** Node.js child processes, Tesseract, Next.js, PostgreSQL, Vitest, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-26-image-attachment-ocr-design.md`

## Global Constraints

- Only PNG and JPEG image formats are indexed.
- Images above 12 megapixels remain attached but are not OCR-indexed.
- OCR uses local English Tesseract, shell-free child process calls, private temporary files, 15-second timeout, and a 200,000-character extracted-text cap.
- No changes to database algorithms or cloud services.

## Review Focus

- MIME/signature mismatch must never feed arbitrary data to Tesseract.
- Malformed JPEG segment lengths must not cause out-of-range reads or an infinite scan.
- Over-limit compressed images must not trigger OCR resource use.
- OCR failure must leave the original attachment downloadable.

---

### Task 1: Bounded image OCR

**Files:** `lib/attachments.ts`, `tests/attachments.test.ts`, `tests/fixtures/`.

- [x] Add real PNG and JPEG OCR tests; observe failure before implementation.
- [x] Implement PNG/JPEG signature and dimension validation, including the pixel limit, then invoke Tesseract safely.
- [x] Run focused and full Vitest suites.

### Task 2: Upload, search, and user-facing behavior

**Files:** `tests/ui/attachments.spec.ts`, `components/AttachmentWidget.tsx`, `README.md`, `docs/DEMO_GUIDE.md`, `docs/IMPLEMENTATION_STATUS.md`.

- [x] Extend the browser test to upload PNG/JPEG fixtures and find their OCR text through memory search.
- [x] Run it against PostgreSQL before and after implementation.
- [x] Explain supported image formats, size limit, and local OCR in the UI and documentation.
- [x] Run production Docker, health, and complete test checks.

### Task 3: Delivery

- [x] Review the diff, record verified status, commit the change, and push `main`.
