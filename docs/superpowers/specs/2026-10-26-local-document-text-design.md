# Local document text extraction design

## Intent

Make attached PDFs searchable from the MemoryScape library, including scanned PDFs whose pages contain images rather than a text layer. Processing stays on the local application host and uses established Poppler and Tesseract command-line tools; no document content is sent to a third party.

## Goals

- Extract embedded PDF text first, then OCR scanned pages when no usable text is present.
- Bound work by the existing 10 MiB upload limit, extract no more than 100 text pages or OCR the first 10 scanned pages, cap rendered page dimensions, and impose subprocess timeouts.
- Invoke tools without a shell, isolate files in a temporary directory, and remove temporary files in a `finally` block.
- Preserve upload/download behavior when extraction tools are missing or a PDF has no readable text; report whether extracted text is available so the UI can explain searchability.
- Install extraction tools in the production web image and document local development prerequisites.

## Non-goals

- No cloud OCR, retrieval model, or OCR for unsupported image formats; scanned-PDF OCR remains capped at the first 10 pages.
- No changes to attachment bytes, hashes, backups, or PostgreSQL full-text search semantics.

## Approach

Use Poppler `pdfinfo` and `pdftotext` for PDF metadata and embedded text. Extract at most 100 pages of existing text. If no text is recovered, render at most 10 pages with `pdftoppm` at a bounded size and invoke Tesseract in English for each page. Use `execFile` with fixed arguments and timeouts, never a shell. Keep existing extracted text as the sole indexed representation; expose a boolean searchability field to the UI instead of adding a new schema field.

## Verification

Unit tests use checked-in, small searchable and scanned PDF fixtures and execute the real local extraction tools. API browser tests upload each fixture and verify indexed content is discoverable with ordinary memory search. Tests also verify malformed PDFs stay attached but are reported as not searchable. Docker build verifies the runtime image includes Poppler and Tesseract.
