#!/usr/bin/env python3
"""Create unshaded report figures in LibreOffice Draw through its UNO interface."""
from pathlib import Path
import time
import uno
from com.sun.star.beans import PropertyValue

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "report_assets"
ASSETS.mkdir(parents=True, exist_ok=True)


def prop(name, value):
    item = PropertyValue()
    item.Name = name
    item.Value = value
    return item


def connect():
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    url = "uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext"
    for _ in range(40):
        try:
            return resolver.resolve(url)
        except Exception:
            time.sleep(0.25)
    raise RuntimeError("Start LibreOffice with a UNO socket on port 2002 before running this script")


ctx = connect()
desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)


def new_draw():
    doc = desktop.loadComponentFromURL("private:factory/sdraw", "_blank", 0, ())
    page = doc.getDrawPages().getByIndex(0)
    page.Width = 29700
    page.Height = 21000
    return doc, page


def rectangle(doc, page, x, y, w, h):
    shape = doc.createInstance("com.sun.star.drawing.RectangleShape")
    shape.setPosition(uno.createUnoStruct("com.sun.star.awt.Point", x, y))
    shape.setSize(uno.createUnoStruct("com.sun.star.awt.Size", w, h))
    shape.FillStyle = uno.Enum("com.sun.star.drawing.FillStyle", "NONE")
    shape.LineStyle = uno.Enum("com.sun.star.drawing.LineStyle", "SOLID")
    shape.LineColor = 0x000000
    shape.LineWidth = 45
    page.add(shape)


def text(doc, page, x, y, w, h, value, size=11, bold=False):
    shape = doc.createInstance("com.sun.star.drawing.TextShape")
    shape.setPosition(uno.createUnoStruct("com.sun.star.awt.Point", x, y))
    shape.setSize(uno.createUnoStruct("com.sun.star.awt.Size", w, h))
    shape.FillStyle = uno.Enum("com.sun.star.drawing.FillStyle", "NONE")
    shape.LineStyle = uno.Enum("com.sun.star.drawing.LineStyle", "NONE")
    shape.CharFontName = "Liberation Sans"
    shape.CharHeight = size
    shape.CharColor = 0x000000
    shape.CharWeight = 150.0 if bold else 100.0
    shape.TextHorizontalAdjust = uno.Enum("com.sun.star.drawing.TextHorizontalAdjust", "CENTER")
    shape.TextVerticalAdjust = uno.Enum("com.sun.star.drawing.TextVerticalAdjust", "CENTER")
    shape.TextAutoGrowWidth = False
    shape.TextAutoGrowHeight = False
    shape.TextLeftDistance = 0
    shape.TextRightDistance = 0
    shape.TextUpperDistance = 0
    shape.TextLowerDistance = 0
    page.add(shape)
    shape.getText().setString(value)


def box(doc, page, x, y, w, h, heading, detail, heading_size=12, detail_size=10):
    rectangle(doc, page, x, y, w, h)
    text(doc, page, x + 250, y + 350, w - 500, 650, heading, heading_size, True)
    text(doc, page, x + 250, y + 1150, w - 500, h - 1450, detail, detail_size)


def line(doc, page, x1, y1, x2, y2):
    shape = doc.createInstance("com.sun.star.drawing.LineShape")
    shape.setPosition(uno.createUnoStruct("com.sun.star.awt.Point", min(x1, x2), min(y1, y2)))
    shape.setSize(uno.createUnoStruct("com.sun.star.awt.Size", abs(x2 - x1), abs(y2 - y1)))
    shape.LineColor = 0x000000
    shape.LineWidth = 40
    page.add(shape)


def save(doc, name):
    doc.storeToURL(uno.systemPathToFileUrl(str(ASSETS / f"{name}.odg")), (prop("FilterName", "draw8"), prop("Overwrite", True)))
    doc.storeToURL(uno.systemPathToFileUrl(str(ASSETS / f"{name}.png")), (prop("FilterName", "draw_png_Export"), prop("Overwrite", True)))
    doc.close(True)


# Basic application-to-database flow and three database engines.
doc, page = new_draw()
text(doc, page, 2000, 650, 25700, 1200, "MemoryScape request and recall flow", 19, True)
box(doc, page, 1200, 3000, 7600, 3000, "WEB INTERFACE", "Map · timeline · graph", 12, 10)
text(doc, page, 8900, 3850, 1200, 1000, "→", 18, True)
box(doc, page, 10300, 3000, 7600, 3000, "API", "Validate · parameterized SQL", 12, 10)
text(doc, page, 18000, 3850, 1200, 1000, "→", 18, True)
box(doc, page, 19400, 3000, 9200, 3000, "POSTGRESQL + POSTGIS", "Filter · rank · update", 12, 10)
line(doc, page, 24000, 6000, 24000, 7400)
line(doc, page, 5150, 7400, 24000, 7400)
for center in (5150, 14850, 24000):
    line(doc, page, center, 7400, center, 8800)
    text(doc, page, center - 500, 7950, 1000, 700, "↓", 13, True)
box(doc, page, 1200, 9000, 7900, 3400, "SPATIAL", "Route proximity · route order", 12, 10)
box(doc, page, 10400, 9000, 8900, 3400, "TEMPORAL", "Decay · reinforcement", 12, 10)
box(doc, page, 19400, 9000, 9200, 3400, "ASSOCIATIVE", "Recursive activation paths", 12, 10)
text(doc, page, 1800, 14600, 25000, 1300, "PostgreSQL computes recall; the interface displays the results.", 11)
save(doc, "architecture")

# Compact relational diagram: each row shows one relationship without crossing lines.
doc, page = new_draw()
text(doc, page, 2000, 650, 25700, 1200, "Core relational model", 19, True)
for y, middle, detail, relation in [
    (3000, "MEMORY_CONTEXTS", "memory_id · context_id", "1 : N      N : 1"),
    (8300, "MEMORY_EDGES", "src · dst FK → memories", "1 : N"),
    (13600, "REINFORCEMENTS", "memory_id FK · strength history", "1 : N"),
]:
    box(doc, page, 700, y, 7500, 2400, "MEMORIES", "id · title · occurred_at · location", 11, 9)
    if y == 3000:
        line(doc, page, 8200, y + 1200, 8900, y + 1200)
        text(doc, page, 8900, y + 850, 1600, 650, "1 : N", 8, True)
        line(doc, page, 10500, y + 1200, 11200, y + 1200)
        box(doc, page, 11200, y, 7500, 2400, middle, detail, 11, 9)
        line(doc, page, 18700, y + 1200, 19500, y + 1200)
        text(doc, page, 19500, y + 850, 1500, 650, "N : 1", 8, True)
        line(doc, page, 21000, y + 1200, 21700, y + 1200)
        box(doc, page, 21700, y, 7300, 2400, "CONTEXTS", "id · type · label", 11, 9)
    else:
        line(doc, page, 8200, y + 1200, 11200, y + 1200)
        text(doc, page, 11200, y + 850, 1800, 650, relation, 9, True)
        line(doc, page, 13000, y + 1200, 16200, y + 1200)
        box(doc, page, 16200, y, 10500, 2400, middle, detail, 11, 9)
text(doc, page, 1500, 19000, 26000, 1000, "Primary and foreign keys keep links and strength history queryable.", 10)
save(doc, "data-model")

# Plain outlined bars. Exact values remain in the report table beside the figure.
doc, page = new_draw()
text(doc, page, 1800, 650, 26000, 1200, "Measured query medians · milliseconds", 19, True)
text(doc, page, 1500, 2500, 12000, 900, "Spatial route plan", 14, True)
text(doc, page, 15700, 2500, 12000, 900, "Fading-memory lookup", 14, True)
spatial = [("10K indexed", 57.510), ("10K sequential", 25.203), ("50K indexed", 58.784), ("50K sequential", 49.212)]
fading = [("10K direct", 198.339), ("10K view", 3.531), ("50K direct", 205.908), ("50K view", 7.493)]
for i, (label, value) in enumerate(spatial):
    y = 3900 + i * 1900
    text(doc, page, 1200, y, 3900, 850, label, 9)
    width = int(value / 210 * 7000)
    rectangle(doc, page, 5300, y + 120, max(width, 100), 500)
    text(doc, page, 5400 + width, y, 2600, 850, f"{value:.3f}", 9)
for i, (label, value) in enumerate(fading):
    y = 3900 + i * 1900
    text(doc, page, 15300, y, 3200, 850, label, 9)
    width = int(value / 210 * 7000)
    rectangle(doc, page, 18500, y + 120, max(width, 100), 500)
    text(doc, page, 18800 + width, y, 2300, 850, f"{value:.3f}", 9)
text(doc, page, 1500, 12600, 26000, 1300, "All bars are unfilled outlines. The measured broad route favored the sequential plan; the materialized view lookup was faster in these trials.", 10)
save(doc, "benchmark-medians")
