"""
Render a generated lease (the markdown-ish text from `lease_generation.generate`)
to a watermarked PDF.

Standalone module (no edits to the generator core). The default watermark is
**PROJET** — until the model wording clears lawyer sign-off and a lease is
`finalisable`, any rendered PDF is a draft.

Security: the generated text embeds user-supplied field values (party names,
address…). Every line is XML-escaped before it reaches reportlab's Paragraph markup,
so a value containing `<`/`&` cannot corrupt or crash the document (same lesson as the
e-sign evidence pack).
"""

import io
import re
from xml.sax.saxutils import escape as _xml_escape


def render_lease_pdf(text: str, *, watermark: str = "PROJET") -> bytes:
    """Render generated lease text to PDF bytes. Watermark defaults to 'PROJET' (draft)."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            HRFlowable, Paragraph, SimpleDocTemplate, Spacer,
        )
    except ImportError:
        raise RuntimeError("reportlab is required to render a lease PDF")

    buf = io.BytesIO()
    width, height = A4

    class _Watermarked(SimpleDocTemplate):
        def handle_pageBegin(self):
            super().handle_pageBegin()
            if not watermark:
                return
            c = self.canv
            c.saveState()
            c.setFont("Helvetica-Bold", 60)
            c.setFillColorRGB(0.9, 0.9, 0.9, alpha=0.30)
            c.translate(width / 2, height / 2)
            c.rotate(45)
            c.drawCentredString(0, 0, watermark)
            c.restoreState()

    doc = _Watermarked(
        buf, pagesize=A4,
        leftMargin=2.2 * cm, rightMargin=2.2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    blue = colors.HexColor("#1A3C6E")
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=blue, fontSize=14, spaceBefore=8, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=blue, fontSize=11, spaceBefore=6, spaceAfter=3)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9, leading=13, spaceAfter=3)

    story = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            story.append(Spacer(1, 4))
            continue
        if line.startswith("<!--") or line.endswith("-->"):   # skip asset HTML comments
            continue
        if line.startswith("### "):
            story.append(Paragraph(_xml_escape(line[4:]), h2))
        elif line.startswith("## "):
            story.append(Paragraph(_xml_escape(line[3:]), h1))
        elif line.startswith("# "):
            story.append(Paragraph(_xml_escape(line[2:]), h1))
        elif re.fullmatch(r"-{3,}", line):
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#999999")))
        else:
            story.append(Paragraph(_xml_escape(line), body))

    doc.build(story or [Paragraph("(vide)", body)])
    return buf.getvalue()
