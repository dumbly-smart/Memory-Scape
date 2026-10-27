# Building the final project report

The final report follows the supplied VIT implementation-based report structure. The editable DOCX is generated from `scripts/build_project_report.py` and exported to PDF with LibreOffice Writer. The architecture and relational diagrams are ordinary bordered tables in the report, so their labels, cells, and connectors can be edited directly in Writer. No diagram images are embedded.

## Requirements

- Python 3.11 or newer
- `python-docx`
- LibreOffice Writer for the PDF export

## Rebuild

```sh
python -m venv /tmp/memoryscape-report-env
/tmp/memoryscape-report-env/bin/pip install python-docx
/tmp/memoryscape-report-env/bin/python scripts/build_project_report.py
mkdir -p /tmp/memoryscape-report-export
libreoffice --headless --convert-to pdf --outdir /tmp/memoryscape-report-export MemoryScape_Project_Report_Final.docx
cp /tmp/memoryscape-report-export/MemoryScape_Project_Report_Final.pdf .
```

The diagrams use unfilled black outlines and text on white. Performance measurements appear in an editable report table rather than a raster chart. The contents page lists the first page of each section and should be checked after edits.

The report bibliography contains exactly 16 sources: 12 peer-reviewed memory, lifelogging, visualization, and personal-information-management papers; Ebbinghaus's foundational book; and three consolidated primary documentation references for PostgreSQL, PostGIS, and pg_cron. The diagrams, charts, document accents, and tables use black and white only. The performance section reports the actual five-trial medians in `docs/evaluation/SCALE_RESULTS.md`, including the sequential-plan result and the trial/cache limitations. It does not describe synthetic measurements as human outcomes.

When content changes, recheck the static page numbers in the report contents and render every PDF page before delivery.
