#!/usr/bin/env python3
"""Build the final MemoryScape implementation-based report from the supplied VIT template."""

from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "AC1855A5C7148BFEF7B640F739CB02C7-4_ImplementationBasedtemplate_1.docx"
OUT = ROOT / "MemoryScape_Project_Report_Final.docx"
ASSETS = ROOT / "docs" / "report_assets"
ASSETS.mkdir(parents=True, exist_ok=True)

NAVY = "000000"
INK = "000000"
MUTED = "000000"
VIOLET = "000000"
BLUE = "000000"
PALE = "FFFFFF"
PALE_BLUE = "FFFFFF"
LINE = "000000"
WHITE = "FFFFFF"
BULLET_NUM_ID = None

def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_margins(cell, top=90, start=110, bottom=90, end=110):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    mar = tc_pr.first_child_found_in("w:tcMar")
    if mar is None:
        mar = OxmlElement("w:tcMar")
        tc_pr.append(mar)
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = mar.find(qn(f"w:{side}"))
        if node is None:
            node = OxmlElement(f"w:{side}")
            mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def add_field(paragraph, instr):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    text = OxmlElement("w:instrText")
    text.set(qn("xml:space"), "preserve")
    text.text = instr
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for el in (begin, text, separate, placeholder, end):
        run._r.append(el)


def add_hyperlink(paragraph, text, url):
    part = paragraph.part
    rid = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), rid)
    run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), BLUE)
    rpr.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    rpr.append(underline)
    run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    run.append(t)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_keep_with_next(paragraph):
    paragraph.paragraph_format.keep_with_next = True


def add_page_field(paragraph):
    add_field(paragraph, "PAGE")


def setup_document():
    global BULLET_NUM_ID
    doc = Document(TEMPLATE)
    body = doc._element.body
    sect = body.sectPr
    for child in list(body):
        if child is not sect:
            body.remove(child)
    # One consistent section preserves the supplied template's paper size and margins.
    for section in doc.sections:
        section.top_margin = Inches(0.72)
        section.bottom_margin = Inches(0.68)
        section.left_margin = Inches(0.82)
        section.right_margin = Inches(0.82)
        section.header_distance = Inches(0.35)
        section.footer_distance = Inches(0.32)
        header = section.header.paragraphs[0]
        header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = header.add_run("MEMORYSCAPE  /  BCSE497J · PROJECT I")
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(8), True
        r.font.color.rgb = RGBColor.from_string(MUTED)
        footer = section.footer.paragraphs[0]
        footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        rr = footer.add_run("VIT VELLORE  ·  IMPLEMENTATION-BASED REPORT  ·  PAGE ")
        rr.font.name, rr.font.size = "Arial", Pt(8)
        rr.font.color.rgb = RGBColor.from_string(MUTED)
        add_page_field(footer)
    styles = doc.styles
    bullet_style = styles.add_style("Report Bullet", WD_STYLE_TYPE.PARAGRAPH)
    bullet_style.base_style = styles["Normal"]
    bullet_style.font.name = "Arial"
    bullet_style.font.size = Pt(10.5)
    bullet_style.paragraph_format.space_after = Pt(3)
    numbering = doc.part.numbering_part.element
    abstract_ids = [int(el.get(qn("w:abstractNumId"))) for el in numbering.findall(qn("w:abstractNum"))]
    num_ids = [int(el.get(qn("w:numId"))) for el in numbering.findall(qn("w:num"))]
    abstract_id = max(abstract_ids, default=-1) + 1
    BULLET_NUM_ID = max(num_ids, default=0) + 1
    abstract = OxmlElement("w:abstractNum")
    abstract.set(qn("w:abstractNumId"), str(abstract_id))
    multi = OxmlElement("w:multiLevelType")
    multi.set(qn("w:val"), "singleLevel")
    abstract.append(multi)
    lvl = OxmlElement("w:lvl")
    lvl.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:start"); start.set(qn("w:val"), "1")
    fmt = OxmlElement("w:numFmt"); fmt.set(qn("w:val"), "bullet")
    txt = OxmlElement("w:lvlText"); txt.set(qn("w:val"), "•")
    jc = OxmlElement("w:lvlJc"); jc.set(qn("w:val"), "left")
    lvl.append(start); lvl.append(fmt); lvl.append(txt); lvl.append(jc)
    ppr = OxmlElement("w:pPr")
    ind = OxmlElement("w:ind"); ind.set(qn("w:left"), "360"); ind.set(qn("w:hanging"), "180")
    ppr.append(ind); lvl.append(ppr)
    abstract.append(lvl)
    numbering.append(abstract)
    num = OxmlElement("w:num"); num.set(qn("w:numId"), str(BULLET_NUM_ID))
    abstract_ref = OxmlElement("w:abstractNumId"); abstract_ref.set(qn("w:val"), str(abstract_id))
    num.append(abstract_ref); numbering.append(num)
    normal = styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.13
    for name, size, color in [("Report Heading 1", 19, NAVY), ("Report Heading 2", 13, VIOLET), ("Report Heading 3", 11, BLUE)]:
        s = styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        s.base_style = normal
        s.font.name = "Arial"
        s.font.size = Pt(size)
        s.font.bold = True
        s.font.color.rgb = RGBColor.from_string(color)
        s.paragraph_format.space_before = Pt(12 if name != "Heading 1" else 2)
        s.paragraph_format.space_after = Pt(5)
    cap = styles["Caption"]
    cap.font.name, cap.font.size = "Arial", Pt(8.5)
    cap.font.color.rgb = RGBColor.from_string(MUTED)
    cap.font.italic = True
    return doc


def add_p(doc, text="", style=None, align=None, bold_prefix=None):
    p = doc.add_paragraph(style=style)
    if align is not None:
        p.alignment = align
    if bold_prefix and text.startswith(bold_prefix):
        p.add_run(bold_prefix).bold = True
        p.add_run(text[len(bold_prefix):])
    else:
        p.add_run(text)
    return p


def add_bullets(doc, entries):
    for text in entries:
        p = doc.add_paragraph(style="Report Bullet")
        p.paragraph_format.left_indent = Inches(0.22)
        p.paragraph_format.first_line_indent = Inches(-0.12)
        p.paragraph_format.space_after = Pt(3)
        num_pr = OxmlElement("w:numPr")
        ilvl = OxmlElement("w:ilvl"); ilvl.set(qn("w:val"), "0")
        num_id = OxmlElement("w:numId"); num_id.set(qn("w:val"), str(BULLET_NUM_ID))
        num_pr.append(ilvl); num_pr.append(num_id); p._p.get_or_add_pPr().append(num_pr)
        p.add_run(text)


def add_heading(doc, text, level=1):
    p = doc.add_paragraph(text, style=f"Report Heading {level}")
    set_keep_with_next(p)
    return p


def add_table(doc, headers, rows, widths=None, font_size=8.8):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    table.autofit = False
    hdr = table.rows[0]
    set_repeat_table_header(hdr)
    for i, title in enumerate(headers):
        cell = hdr.cells[i]
        set_cell_shading(cell, "FFFFFF")
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(title)
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(font_size), True
        r.font.color.rgb = RGBColor(0, 0, 0)
    for ridx, row in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cell = cells[i]
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cell.paragraphs[0].paragraph_format.space_after = Pt(0)
            set_cell_margins(cell)
            set_cell_shading(cell, "FFFFFF")
            run = cell.paragraphs[0].add_run(str(value))
            run.font.name, run.font.size = "Arial", Pt(font_size)
            run.font.color.rgb = RGBColor.from_string(INK)
    if widths:
        for row in table.rows:
            for index, width in enumerate(widths):
                row.cells[index].width = Inches(width)
    add_p(doc, "", style=None)
    return table


def add_figure(doc, filename, caption, width=6.55):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.keep_together = True
    p.add_run().add_picture(str(ASSETS / filename), width=Inches(width))
    c = doc.add_paragraph(caption, style="Caption")
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.keep_together = True
    return c


def add_callout(doc, title, body, fill=PALE_BLUE):
    table = doc.add_table(rows=1, cols=1)
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        edge = OxmlElement(f"w:{side}")
        edge.set(qn("w:val"), "single")
        edge.set(qn("w:sz"), "8")
        edge.set(qn("w:color"), "000000")
        borders.append(edge)
    tc_pr.append(borders)
    set_cell_margins(cell, top=160, bottom=160, start=190, end=190)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(title + "  ")
    r.bold = True
    r.font.color.rgb = RGBColor.from_string(NAVY)
    p.add_run(body)
    add_p(doc, "")


def page_break(doc):
    doc.add_page_break()


def add_reference(doc, number, text, url=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.left_indent = Inches(0.24)
    p.paragraph_format.first_line_indent = Inches(-0.24)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run(f"[{number}] {text} ")
    run.font.size = Pt(9.2)
    if isinstance(url, list):
        for label, target in url:
            add_hyperlink(p, f"[{label}]", target)
            p.add_run(" ")
    elif url:
        add_hyperlink(p, "[source]", url)


def generate():
    doc = setup_document()

    # Cover page: formal VIT title-page structure, with restrained project identity.
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(52)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("BCSE497J  ·  PROJECT I")
    r.font.name, r.font.size, r.font.bold = "Arial", Pt(15), True
    r.font.color.rgb = RGBColor.from_string(VIOLET)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before, p.paragraph_format.space_after = Pt(25), Pt(9)
    r = p.add_run("MEMORYSCAPE")
    r.font.name, r.font.size, r.font.bold = "Arial", Pt(32), True
    r.font.color.rgb = RGBColor.from_string(NAVY)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(24)
    r = p.add_run("A Spatiotemporal Personal Knowledge Graph\nwith Biologically Inspired Recall")
    r.font.name, r.font.size = "Arial", Pt(18)
    r.font.color.rgb = RGBColor.from_string(INK)
    band = doc.add_table(rows=1, cols=1)
    band.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = band.cell(0, 0)
    set_cell_shading(cell, "FFFFFF")
    set_cell_margins(cell, top=220, bottom=220, start=250, end=250)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("IMPLEMENTATION-BASED PROJECT REPORT")
    r.font.name, r.font.size, r.font.bold = "Arial", Pt(11), True
    r.font.color.rgb = RGBColor(0, 0, 0)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(26)
    r = p.add_run("Prepared by")
    r.font.size = Pt(11)
    for line in ["Akil  ·  25BCE2777", "Syon Vijae Thyvalappil  ·  25BCE2598"]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(line)
        r.font.name, r.font.size, r.font.bold = "Arial", Pt(13), True
        r.font.color.rgb = RGBColor.from_string(NAVY)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(40)
    for line in ["School of Computer Science and Engineering", "Vellore Institute of Technology, Vellore", "October 2026"]:
        r = p.add_run(line + "\n")
        r.font.name, r.font.size = "Arial", Pt(10.5)
        r.font.color.rgb = RGBColor.from_string(MUTED)
    page_break(doc)

    add_heading(doc, "Abstract", 1)
    add_p(doc, "MemoryScape is a local-first personal knowledge system that stores episodes together with event time, geographic position, reusable contexts, and directed associations. Its research focus is to make three recall mechanisms inspectable as database operations: route-based spatial retrieval using PostGIS, temporal strength decay with transactional reinforcement, and explainable associative spreading activation using recursive SQL. The web interface also supports everyday capture, searchable memory management, a current-location-aware spatiotemporal route query, a timeline, a force-directed graph, fading-memory review, and a one-card-at-a-time weekly review. PostgreSQL 16, PostGIS, and pg_cron perform the core retrieval, strength updates, and scheduled view maintenance; no embedding model, vector database, or external AI service is required. Validation includes deterministic database fixtures, a 1,200-memory synthetic dataset, a larger five-trial performance comparison at 10,000 and 50,000 records, 75 unit/application tests, and 15 targeted browser/integration tests for the current graph and map changes. In the measured broad-route workload, a controlled sequential plan was faster than the spatial-index candidate, while a materialized fading-memory lookup was much faster than its direct-query comparison. These findings are workload-specific. They establish neither a general index speedup nor human recall benefit, biological validity, or usability; no participant study has been conducted. [1–8, 9–16]")
    add_heading(doc, "Keywords", 2)
    add_p(doc, "PostgreSQL; PostGIS; personal knowledge graph; episodic memory; spatial retrieval; temporal decay; recursive SQL; synthetic evaluation")
    add_callout(doc, "Evidence boundary", "Cognitive theories motivate the design vocabulary; the implemented formulas are deterministic engineering choices. Synthetic correctness and query timings are not evidence of biological fidelity or improved human memory.")
    page_break(doc)

    add_heading(doc, "Report contents", 1)
    toc_rows = [
        ("Abstract", "Summary and evidence boundary", "2"),
        ("1. Introduction", "Problem, scope, contribution", "4"),
        ("2. Literature Study", "Memory cues, spatial context, association, forgetting", "5"),
        ("3. Objectives", "Research questions and measurable objectives", "6"),
        ("4. Design", "Architecture, schema, and three recall engines", "7"),
        ("5. Implementation and Evaluation", "Features, data, validation, measurements, limitations", "10"),
        ("6. Conclusion and Future Work", "Findings and next research steps", "14"),
        ("References", "Research literature and primary technical documentation", "15"),
    ]
    add_table(doc, ["Section", "Coverage", "Page"], toc_rows, [2.35, 3.45, 0.55], 9.2)
    add_p(doc, "Document version: final implementation-based report · 27 October 2026", style="Caption")
    page_break(doc)

    add_heading(doc, "1. Introduction", 1)
    add_heading(doc, "1.1 Problem and motivation", 2)
    add_p(doc, "A personal episode is more than a text fragment: it happens at a time and place, involves people or activities, and may become a cue for remembering other episodes. Research on episodic memory emphasizes recollection of events situated in subjective time, while retrieval-cue theory explains why context present at encoding can affect later access [1, 2]. Personal-information retrieval research connects memory lapses to difficulty refinding saved information [10], and lifelogging reviews describe the challenge of organizing heterogeneous personal records for later retrieval [12]. A conventional note list can preserve prose but often leaves these relations implicit. MemoryScape makes time, location, context, and association explicit so they can be queried and explained with database operations.")
    add_heading(doc, "1.2 Project scope", 2)
    add_p(doc, "This is a local-first software research prototype for an individual workspace. The term ‘biologically inspired’ describes analogies used to organize recall—contextual cues, fading strength, reinforcement, and association. It does not assert that PostgreSQL functions reproduce neural processes. The prototype deliberately excludes machine learning, semantic embeddings, vector stores, LLM retrieval, and paid APIs. Map tiles may be fetched from a configured OpenStreetMap-compatible tile source; memory content and algorithmic processing remain local. Lifelog design literature also cautions against assuming that total capture alone produces useful recall and stresses the importance of selective, accessible cues [9, 12, 13]. Technical mechanisms are documented in the database and spatial references [14–16].")
    add_heading(doc, "1.3 Contributions", 2)
    add_bullets(doc, [
        "A normalized PostgreSQL model for episodic records, reusable contexts, directed edges, and auditable reinforcement history.",
        "A route and time-window recall query with meter-based PostGIS geography distance and deterministic along-route order.",
        "Set-based exponential strength decay and row-locked reinforcement routines that record before/after values.",
        "Cycle-aware recursive associative traversal with configurable threshold, explainable winning paths, and an interface/API depth bound of 32 hops.",
        "Scheduled fading-memory review, an interactive map/timeline/graph, and practical capture, organization, and review workflows.",
        "Reproducible correctness, synthetic robustness, and database performance evaluation, with limitations reported alongside measured values."
    ])
    add_heading(doc, "1.4 System context", 2)
    add_p(doc, "The motivating synthetic profile represents a fictional VIT Vellore student whose episodic stream includes campus study, travel to Kannur during holidays, family and peer contexts, and vacations. It is generated data only: no real student diary or location history is included. The profile supports coherent demonstrations of routes, time windows, people/place contexts, and graph links rather than pretending to be participant evidence.")
    page_break(doc)

    add_heading(doc, "2. Literature Study", 1)
    add_heading(doc, "2.1 Episodic context and retrieval cues", 2)
    add_p(doc, "Tulving’s account distinguishes episodic recollection of personally experienced events from general semantic knowledge [1]. Encoding-specificity work emphasizes that effective retrieval cues depend on the relation between learning context and the cue at test [2]. Personal information management research has examined how memory lapses affect refinding saved information and how retrieval tools can support that task [10]. Lifelogging research adds an important product-design caveat: more capture is not automatically more useful, and interaction cost affects whether people use digital records [9, 12]. MemoryScape operationalizes a narrow engineering analogue: event time, place, and named contexts are first-class fields and can be supplied as explicit query constraints or displayed beside a recalled episode. The implementation does not infer which cue would be psychologically effective.")
    add_heading(doc, "2.2 Spatial and temporal cues", 2)
    add_p(doc, "Tolman introduced the cognitive-map concept to discuss spatially organized learning [3]. Autobiographical-memory models also describe hierarchies of lifetime periods, general events, and event-specific knowledge [4]. Temporal-context models explain recency and contiguity through evolving contextual states, rather than treating elapsed time as the only cause of recall changes [5]. Prior work has explicitly paired map and timeline views to make location histories easier to reminisce about [11], while a 2022 review describes location, time, and other lifelog modalities as complementary retrieval context [12]. These works motivate storing spatial and temporal context together; MemoryScape’s route corridor and event-time interval remain deterministic database queries, not implementations of those cognitive theories.")
    add_heading(doc, "2.3 Associative spreading activation", 2)
    add_p(doc, "Collins and Loftus proposed a spreading-activation account of semantic processing in which activation moves through associations [6]. MemoryScape adopts the graph-search analogy but makes every edge, coefficient, hop, and path inspectable. The target score is computed by SQL using edge weight, target strength, and a configurable valence-salience term. Unlike a cognitive model, the system uses hand-set bounded values, prunes at a user-selected threshold, and limits traversal to 32 hops for operational safety.")
    add_heading(doc, "2.4 Forgetting is not a single universal curve", 2)
    add_p(doc, "Ebbinghaus established an experimental tradition of measuring retention over time [7]. Later curve-comparison work found that a simple power function fit the tested datasets better than a simple exponential in particular experiments [8]. MemoryScape therefore treats exponential decay, S(t)=S₀e^(−λΔt), as a transparent, configurable software baseline—not as an empirically selected law of human memory. Reinforcement is likewise an engineered update rule, not a validated learning effect.")
    add_heading(doc, "2.5 Database-native implementation", 2)
    add_p(doc, "The technical choices align with documented database mechanisms: PostgreSQL recursive WITH queries, index types, transaction isolation, and materialized views provide the database primitives used here [14]; PostGIS geography predicates express distances in meters, support index-aware filtering, and provide along-line location [15]. pg_cron schedules SQL work inside PostgreSQL [16]. Recent lifelog application-design work emphasizes explicit relationships between personal data, technology, and intended user criteria [13]. MemoryScape’s contribution is an integrated, explainable application of these mechanisms to a personal-memory workflow, not a claim to invent these primitives.")
    page_break(doc)

    add_heading(doc, "3. Objectives and Research Questions", 1)
    add_heading(doc, "3.1 Objectives", 2)
    add_bullets(doc, [
        "Represent memories and their spatial, temporal, contextual, and associative structure with relational integrity constraints.",
        "Implement route-based and spatiotemporal recall in SQL, with PostGIS distance and route ordering.",
        "Make temporal decay and reinforcement atomic, repeatable, and auditable in PostgreSQL.",
        "Implement bounded, cycle-safe associative propagation and return path explanations.",
        "Connect database algorithms to user-facing map, timeline, graph, search, and review workflows.",
        "Measure correctness and performance on deterministic synthetic datasets and report uncertainty and limitations."
    ])
    add_heading(doc, "3.2 Research questions", 2)
    add_table(doc, ["Question", "Operational test"], [
        ("RQ1 · Spatial", "Does PostGIS retrieve points near a user route in meters and order them along that route?"),
        ("RQ2 · Temporal", "Do decay and reinforcement update strength and timestamps atomically, with reinforcement history?"),
        ("RQ3 · Associative", "Can recursive SQL return cycle-safe, bounded, threshold-pruned paths with deterministic scores?"),
        ("RQ4 · Performance", "How do query plans and observed runtimes vary by dataset size, selectivity, depth, and threshold?"),
        ("RQ5 · Review", "How does a materialized fading-memory queue compare with the equivalent direct query, including refresh cost?")
    ], [1.5, 4.9], 9)
    add_heading(doc, "3.3 Evaluation boundary", 2)
    add_p(doc, "The present evidence can answer software-contract and synthetic-workload questions. It cannot establish that people recall more accurately, that the chosen coefficients resemble biology, that a particular interface improves usability, or that timings generalize to other hardware or spatial distributions. Human evaluation requires institutional ethics review, consent, and an adequately justified protocol; none has been conducted.")
    page_break(doc)

    add_heading(doc, "4. Design", 1)
    add_heading(doc, "4.1 Architecture", 2)
    add_p(doc, "The Next.js interface submits validated requests to a TypeScript API. The API issues parameterized SQL against PostgreSQL. The database performs route filtering and ordering, decay and reinforcement, recursive path expansion, and materialized-view refresh. The browser renders geometry, timelines, nodes, edges, and database-provided explanations.")
    add_figure(doc, "architecture.png", "Figure 1. Implemented architecture. PostgreSQL/PostGIS performs the central recall and strength computations.")
    add_heading(doc, "4.2 Relational model and integrity", 2)
    add_p(doc, "The core schema separates reusable context labels from memory records. memory_contexts resolves the many-to-many relationship. memory_edges represents directed associations and permits explicit reciprocal edges. memory_reinforcements records each strength change. UUID primary keys, foreign keys, uniqueness rules, range checks, timestamp defaults, and targeted indexes protect the data contract. A nullable geography(Point,4326) column stores coordinates; timestamps use TIMESTAMPTZ, and occurred_at is kept distinct from last_strength_at.")
    add_figure(doc, "data-model.png", "Figure 2. Core entities and cardinalities. Edge source and destination are two foreign keys back to memories.", width=5.75)
    add_heading(doc, "4.3 Spatial and spatiotemporal recall", 2)
    add_p(doc, "A map route is validated as a non-degenerate LineString and submitted as GeoJSON. SQL constructs a route geography and applies ST_DWithin to memory geography using a radius in meters; PostGIS documents this geography overload in meters and describes the index-aware bounding-box stage [15]. Distance is returned for explanation. ST_LineLocatePoint gives each result a fractional position along the route, followed by stable tie-breaks [15]. The spatiotemporal operation adds a half-open event interval: from ≤ occurred_at < until. Both the spatial corridor and interval are evaluated in the database.")
    add_p(doc, "Spatial Walk and Spatiotemporal Recall request geolocation only in the browser. With permission, the map centers on and marks the current point and offers a one-action route start there. Without permission—or outside a secure context—manual map use remains available. Memory coordinates are not needed to determine the user's live position; the location is used as a query/route cue.")
    add_heading(doc, "4.4 Temporal decay and reinforcement", 2)
    add_p(doc, "Elapsed time is measured in days. At logical time t, the database computes S(t)=clamp(S₀·exp(−λΔt),0,1), advancing last_strength_at in the same update. A repeat call at the same logical timestamp has zero elapsed duration. Reinforcement first accounts for unapplied decay, locks the memory row, then computes S′=min(1,S+α(1−S)); the before/after values, type, and amount are written in the same transaction. Adding an already-linked context does not issue a second reinforcement. The exponential and reinforcement equations are configurable product rules, not constants fitted from participants [5, 7, 8].")
    add_heading(doc, "4.5 Associative spreading activation", 2)
    add_p(doc, "For a seed activation A₀, each recursive step is A_next=A_current×edge_weight×(β₀+β₁|valence|)×target_strength. The default salience values are β₀=0.75 and β₁=0.25; settings expose the coefficients. Both positive and negative signed valence can provide a salient cue, while the original sign remains available for explanation. The recursive CTE carries node and edge arrays, rejects a node already in the current path, enforces a threshold within recursion, and stops at the requested hop depth (maximum 32). Multiple paths to the same memory are ranked deterministically, with the strongest valid path returned as the explanation [6, 14].")
    add_heading(doc, "4.6 Fading review and weekly review", 2)
    add_p(doc, "A PostgreSQL materialized view stores fading-memory candidates and a deterministic review priority; pg_cron refreshes it hourly while decay runs daily [14, 16]. The interface shows the view's refresh time because its data is a scheduled snapshot. Weekly Review displays one card at a time: swipe right keeps it, swipe left archives it recoverably, and explicit Keep/Snooze/Archive/Dismiss controls provide accessible alternatives. Sensitive and archived memories are excluded from review queues.")
    page_break(doc)

    add_heading(doc, "5. Implementation and Evaluation", 1)
    add_heading(doc, "5.1 Implemented system", 2)
    add_table(doc, ["Layer", "Current implementation"], [
        ("Database", "PostgreSQL 16; PostGIS geography; pg_cron; SQL migrations, constraints, GiST/B-tree indexes, functions, recursive CTEs, transactions, and materialized views."),
        ("API", "Node.js and TypeScript, node-postgres, runtime validation, parameterized queries, and transaction boundaries."),
        ("Web application", "Next.js 16, React 19, Tailwind CSS 4; Leaflet maps; Cytoscape force-directed associative graph; timeline and review interfaces."),
        ("Evaluation", "Vitest, PostgreSQL SQL contract tests, concurrency checks, Playwright workflows, EXPLAIN ANALYZE runners, and deterministic synthetic generators.")
    ], [1.4, 5.0], 8.8)
    add_heading(doc, "5.2 Product workflows beyond the three engines", 2)
    add_p(doc, "Current implementation extends the original research interaction into daily use:")
    add_bullets(doc, [
        "Memory Library: create, edit, delete, search, sort, and filter memories; manage contexts, associations, and location details.",
        "Capture and organization: quick capture, bookmarklet import, people/project workspaces, decisions, and follow-ups.",
        "Recall: nearby-place query, route-based spatial walk, event-time spatiotemporal recall, timeline filters, and graph exploration up to 32 hops.",
        "Review: fading-memory dashboard, daily brief, and one-card weekly review with recoverable archive behavior.",
        "Personal data tools: local document and image text extraction/OCR, encrypted offline capture queue, and portable encrypted backup/restore.",
        "Controls: independent importance, sensitive-data and archive flags; browser permission is requested for live location; local-first deployment binds services to localhost by default."
    ])
    add_heading(doc, "5.3 Synthetic data and correctness", 2)
    add_p(doc, "A deterministic 1,200-memory validation dataset and a fictional VIT–Kannur student stream exercise meaningful campus, home-travel, vacation, person, and topic contexts. The optional benchmark generator creates 10,000 and 50,000 memory datasets with clustered coordinates and structured graph links. Research correctness fixtures are smaller and labeled with expected route and association results; their precision/recall values describe only those constructed labels.")
    add_table(doc, ["Validation evidence", "Latest recorded result"], [
        ("Unit/application suite", "75 Vitest tests passed across 19 files."),
        ("Current graph/map integration", "15 Playwright tests passed, including four-hop SQL/API traversal, custom hop input, map centering, location route start, reinforcement, and spatiotemporal route workflow."),
        ("Type and service checks", "TypeScript no-emit check passed; Docker web image started; health endpoint reported PostgreSQL 16.15 and PostGIS 3.6.4."),
        ("Database migration", "015_associative_depth.sql applied and recorded in schema_migrations; it raises recursive recall's validated maximum depth to 32."),
        ("Research SQL fixture", "Synthetic eight-memory baseline: precision 0.833, recall 1.000, F1 0.909, MRR 1.000; not participant outcomes.")
    ], [1.85, 4.55], 8.6)
    add_heading(doc, "5.4 Performance protocol", 2)
    add_p(doc, "The scale comparison runs five sequential trials for each synthetic size (10,000 and 50,000 memories). Each observation follows a PostgreSQL restart, which resets shared_buffers, but the protocol does not flush operating-system cache. Data is generated from clustered campus distributions. Values below are observed medians from this host and this workload; they are not cold-disk latency, an independent-machine sample, or a general service-level expectation. [14–16]")
    add_figure(doc, "benchmark-medians.png", "Figure 3. Median execution time from five restart-only trials; exact values and caveats are also listed in Table 3.")
    add_table(doc, ["Query (median ms)", "10,000 memories", "50,000 memories"], [
        ("Spatial index candidate", "57.510", "58.784"),
        ("Controlled sequential plan", "25.203", "49.212"),
        ("Associative recall · depth 1", "0.405", "0.190"),
        ("Associative recall · depth 2", "0.303", "0.166"),
        ("Associative recall · depth 3", "0.445", "0.198"),
        ("Fading-memory materialized view", "3.531", "7.493"),
        ("Equivalent direct fading query", "198.339", "205.908"),
        ("Timeline query", "0.132", "0.091")
    ], [3.4, 1.5, 1.5], 8.5)
    add_p(doc, "Table 3. Five sequential restart-only medians. The 1–3-hop timings are the measured depth sweep; the new interface accepts up to 32, but this table does not claim a 32-hop benchmark.", style="Caption")
    add_heading(doc, "5.5 Findings and interpretation", 2)
    add_bullets(doc, [
        "Spatial candidate plan: at both tested sizes, the planner-selected index candidate was slower than the controlled sequential plan. The tested route was broad and dense; this result is a warning against a blanket index-speedup claim, not evidence that GiST is generally slower.",
        "Fading queue: lookup against the materialized view was faster in these trials than the equivalent direct query (3.531 vs 198.339 ms at 10K; 7.493 vs 205.908 ms at 50K). Refresh still costs time: the measured median refresh was 483.634 ms at 10K and 415.968 ms at 50K.",
        "Recursive traversal: the tested 1–3-hop calls were sub-millisecond medians on this fixture and host. Result growth and branching factor can dominate deeper traversal; 32 is a safety bound, not a performance guarantee.",
        "Synthetic ablation: disabling individual weights did not change the labeled baseline F1 in this small fixture, although valence neutralization reduced MRR from 1.000 to 0.500. This suggests the fixture is too small to support broad parameter conclusions; it is useful for checking deterministic behavior, not validating a cognitive theory."
    ])
    add_heading(doc, "5.6 Limitations and threats to validity", 2)
    add_bullets(doc, [
        "No human-participant study: recall effectiveness, usability, privacy perceptions, accessibility outcomes, and biological relevance remain unmeasured.",
        "The synthetic locations and edges are generated clusters, not representative personal histories or naturally distributed geographic workloads.",
        "Five sequential trials on one host provide weak evidence for general performance; restart-only does not guarantee a cold operating-system cache, and dataset sizes were not interleaved.",
        "The broad route returned many candidates, limiting its ability to demonstrate selective spatial-index behavior. The current evidence does not support a general causal speedup claim.",
        "Exponential forgetting and activation coefficients are hand-set engineering parameters; competing memory functions and retrieval interference are not modeled [5, 8].",
        "Traversal is bounded to 32 hops and the visualization further caps displayed nodes/edges; dense graphs can still be expensive at the upper bound.",
        "Map tile display may require internet access and follows the configured tile provider's use policy; memory processing itself does not require a paid service."
    ])
    page_break(doc)

    add_heading(doc, "6. Conclusion and Future Work", 1)
    add_p(doc, "MemoryScape now integrates everyday personal-knowledge workflows with three database-native recall engines. PostGIS filters and orders route memories; PostgreSQL functions apply elapsed temporal decay and transactional reinforcement; recursive CTEs perform weighted, cycle-safe association with path explanations and a user-selected depth up to 32. The surrounding application adds current-location-aware spatial and spatiotemporal maps, an interactive graph, timeline, fading review, and one-card weekly review, along with capture, organization, import/export, attachment extraction, and local-first controls.")
    add_p(doc, "The current evidence supports implementation feasibility and testable SQL contracts. On a broad clustered route, the controlled sequential plan was faster than the spatial-index candidate, while the materialized review view had a much lower query median than recomputing the equivalent direct query. These measured outcomes are limited to a synthetic workload and one host. Nothing in the current evaluation shows that the system improves human memory or recreates biological processes.")
    add_heading(doc, "Future work", 2)
    add_bullets(doc, [
        "Expand the spatial study with controlled route selectivity, realistic mobility distributions, randomized/interleaved runs, and independent hardware environments.",
        "Profile graph branching and candidate counts at depths 4–32; test result quality, termination behavior, and resource limits on dense synthetic graphs.",
        "Compare the fixed exponential strength rule with alternatives as an explicit engineering evaluation; do not tune to participants without a preregistered protocol.",
        "Complete an institutionally reviewed, consented usability/recall study with justified sample size, clear separation from synthetic tests, and privacy-preserving data handling.",
        "Continue accessibility and cross-browser verification, including geolocation denial, insecure contexts, reduced motion, keyboard-only review, and offline operation."
    ])
    add_callout(doc, "Project conclusion", "MemoryScape is an implemented database systems prototype with reproducible synthetic evaluation—not an empirically validated cognitive aid.", PALE)
    page_break(doc)

    add_heading(doc, "References", 1)
    refs = [
        ("Tulving, E. (2002). Episodic memory: From mind to brain. Annual Review of Psychology, 53, 1–25. DOI: 10.1146/annurev.psych.53.100901.135114.", "https://doi.org/10.1146/annurev.psych.53.100901.135114"),
        ("Tulving, E., & Thomson, D. M. (1973). Encoding specificity and retrieval processes in episodic memory. Psychological Review, 80(5), 352–373. DOI: 10.1037/h0020071.", "https://doi.org/10.1037/h0020071"),
        ("Tolman, E. C. (1948). Cognitive maps in rats and men. Psychological Review, 55(4), 189–208. DOI: 10.1037/h0061626.", "https://doi.org/10.1037/h0061626"),
        ("Conway, M. A., & Pleydell-Pearce, C. W. (2000). The construction of autobiographical memories in the self-memory system. Psychological Review, 107(2), 261–288. DOI: 10.1037/0033-295X.107.2.261.", "https://doi.org/10.1037/0033-295X.107.2.261"),
        ("Howard, M. W., & Kahana, M. J. (2002). A distributed representation of temporal context. Journal of Mathematical Psychology, 46(3), 269–299. DOI: 10.1006/jmps.2001.1388.", "https://doi.org/10.1006/jmps.2001.1388"),
        ("Collins, A. M., & Loftus, E. F. (1975). A spreading-activation theory of semantic processing. Psychological Review, 82(6), 407–428. DOI: 10.1037/0033-295X.82.6.407.", "https://doi.org/10.1037/0033-295X.82.6.407"),
        ("Ebbinghaus, H. (1913). Memory: A contribution to experimental psychology (H. A. Ruger & C. E. Bussenius, Trans.). Teachers College, Columbia University. (Original work published 1885).", "https://archive.org/details/memorycontributi00ebbi"),
        ("Wixted, J. T., & Ebbesen, E. B. (1991). On the form of forgetting. Psychological Science, 2(6), 409–415. DOI: 10.1111/j.1467-9280.1991.tb00175.x.", "https://doi.org/10.1111/j.1467-9280.1991.tb00175.x"),
        ("Sellen, A., & Whittaker, S. (2010). Beyond total capture: A constructive critique of lifelogging. Communications of the ACM, 53(5), 70–77. DOI: 10.1145/1735223.1735243.", "https://doi.org/10.1145/1735223.1735243"),
        ("Elsweiler, D., Ruthven, I., & Jones, C. (2007). Towards memory-supporting personal information management tools. Journal of the American Society for Information Science and Technology, 58(7), 924–946. DOI: 10.1002/asi.20570.", "https://doi.org/10.1002/asi.20570"),
        ("Thudt, A., Baur, D., & Carpendale, S. (2013). Visits: A spatiotemporal visualization of location histories. EuroVis Short Papers, 79–83. DOI: 10.2312/PE.EuroVisShort.EuroVisShort2013.079-083.", "https://doi.org/10.2312/PE.EuroVisShort.EuroVisShort2013.079-083"),
        ("Ribeiro, R., Trifan, A., & Neves, A. J. R. (2022). Lifelog retrieval from daily digital data: Narrative review. JMIR mHealth and uHealth, 10(5), e30517. DOI: 10.2196/30517.", "https://doi.org/10.2196/30517"),
        ("Duane, A., Jónsson, B. Þ., Lee, H., & Gurrin, C. (2023). LAD: An application design model to support the analysis of large-scale personal data collections generated by lifelogging. Personal and Ubiquitous Computing, 27, 2133–2145. DOI: 10.1007/s00779-023-01726-z.", "https://doi.org/10.1007/s00779-023-01726-z"),
        ("PostgreSQL Global Development Group. (2026). PostgreSQL 16 documentation: Recursive WITH queries, indexes and index types, transaction isolation, and materialized views.", [("WITH", "https://www.postgresql.org/docs/16/queries-with.html"), ("Indexes", "https://www.postgresql.org/docs/16/indexes.html"), ("Transactions", "https://www.postgresql.org/docs/16/transaction-iso.html"), ("Materialized views", "https://www.postgresql.org/docs/16/sql-creatematerializedview.html")]),
        ("PostGIS Project Steering Committee. (2026). PostGIS reference: ST_DWithin and ST_LineLocatePoint.", [("ST_DWithin", "https://postgis.net/docs/ST_DWithin.html"), ("ST_LineLocatePoint", "https://postgis.net/docs/ST_LineLocatePoint.html")]),
        ("Citus Data. (2026). pg_cron: Run periodic jobs in PostgreSQL. GitHub project documentation.", "https://github.com/citusdata/pg_cron"),
    ]
    for i, (reference, url) in enumerate(refs, 1):
        add_reference(doc, i, reference, url)
    add_p(doc, "The bibliography is limited to 16 sources: 12 peer-reviewed papers, Ebbinghaus’s foundational book, and three consolidated primary technical-documentation references. Product behavior and reported measurements are grounded in the committed implementation and its evaluation artifacts; all synthetic results are identified as such.", style="Caption")

    # Metadata, accessibility defaults, and updateable fields.
    props = doc.core_properties
    props.title = "MemoryScape: A Spatiotemporal Personal Knowledge Graph with Biologically Inspired Recall"
    props.subject = "BCSE497J Project I implementation-based report"
    props.author = "Akil; Syon Vijae Thyvalappil"
    props.keywords = "PostgreSQL, PostGIS, spatiotemporal recall, personal knowledge graph"
    settings = doc.settings._element
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    settings.append(update)
    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    generate()
