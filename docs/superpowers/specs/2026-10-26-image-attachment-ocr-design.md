# Local image attachment OCR design

## Intent

Make photographs and screenshots attached to memories searchable using the same local English Tesseract installation as scanned-PDF fallback.

## Scope

- OCR PNG and JPEG attachments.
- Validate file signatures and dimensions before invoking OCR; reject images above 12 megapixels for indexing while still storing the original attachment.
- Use shell-free Tesseract subprocess execution, a private temporary directory, a 15-second timeout, and the existing extracted-text length cap.
- Keep searchability visible in the attachment panel. No database schema or search algorithm changes.

## Non-goals

- No remote services, automatic image transformation, OCR of GIF/WebP/TIFF/SVG, handwriting recognition guarantees, or non-English language packs.
- OCR is auxiliary attachment indexing; the memory recall algorithms remain PostgreSQL-native.

## Approach

Extend the existing attachment extractor to identify PNG dimensions from IHDR and JPEG dimensions from bounded SOF segment scanning. Only matching image MIME types and signatures within the 12-megapixel limit reach Tesseract. Reuse the existing temporary-file cleanup and safe subprocess options used for PDFs.

## Verification

Unit tests run real Tesseract on small PNG/JPEG fixtures, verify an over-limit image is not indexed, and retain the PDF/text tests. Playwright uploads both image formats and confirms their extracted phrases retrieve the associated memory through PostgreSQL text search.
