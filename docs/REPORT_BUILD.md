# Building the final project report

The final report follows the supplied VIT implementation-based report structure. The editable DOCX and exported PDF are generated from `scripts/build_project_report.py`; the three diagrams are generated into `docs/report_assets/`. The script takes its implementation facts and benchmark values from the versioned project documentation and evaluation artifacts.

## Requirements

- Python 3.11 or newer
- `python-docx` and Pillow
- LibreOffice Writer for the PDF export
- Noto Sans or Liberation Sans fonts for generated diagrams

## Rebuild

```sh
python -m venv /tmp/memoryscape-report-env
/tmp/memoryscape-report-env/bin/pip install python-docx pillow
/tmp/memoryscape-report-env/bin/python scripts/build_project_report.py
mkdir -p /tmp/memoryscape-report-export
libreoffice --headless --convert-to pdf --outdir /tmp/memoryscape-report-export MemoryScape_Project_Report_Final.docx
cp /tmp/memoryscape-report-export/MemoryScape_Project_Report_Final.pdf .
```

The report cites twelve peer-reviewed memory, lifelogging, visualization, and personal-information-management works plus Ebbinghaus's foundational book, primary PostgreSQL/PostGIS/pg_cron documentation, the GeoJSON RFC, and the project evaluation artifacts. The performance section reports the actual five-trial medians in `docs/evaluation/SCALE_RESULTS.md`, including the sequential-plan result and the trial/cache limitations. It does not describe synthetic measurements as human outcomes.

When content changes, recheck the static page numbers in the report contents and render every PDF page before delivery.
