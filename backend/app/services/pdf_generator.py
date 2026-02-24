"""
PDF Generation Service using WeasyPrint.
Converts HTML documents to production-ready PDFs.
"""

import os
from datetime import datetime
from typing import Optional

# WeasyPrint is optional - graceful fallback
try:
    from weasyprint import CSS, HTML

    WEASYPRINT_AVAILABLE = True
except ImportError:
    HTML = None
    CSS = None
    WEASYPRINT_AVAILABLE = False


class PDFGenerator:
    """
    Generates PDFs from HTML content.
    Uses WeasyPrint for high-quality PDF rendering.
    Falls back to HTML-only if WeasyPrint not installed.
    """

    def __init__(self):
        self.output_dir = os.getenv("PDF_OUTPUT_DIR", "./generated_pdfs")
        os.makedirs(self.output_dir, exist_ok=True)

        if not WEASYPRINT_AVAILABLE:
            print("⚠️ WeasyPrint not installed. PDFs will not be generated.")
            print("   Install with: pip install weasyprint")

    async def generate_pdf(
        self, html_content: str, filename: str, css: Optional[str] = None
    ) -> dict:
        """
        Generate PDF from HTML content.

        Returns:
            {
                "success": bool,
                "pdf_path": str | None,
                "html_fallback": bool,
                "error": str | None
            }
        """
        if not WEASYPRINT_AVAILABLE:
            # Fallback: Save HTML only
            html_path = os.path.join(self.output_dir, f"{filename}.html")
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(html_content)

            return {
                "success": True,
                "pdf_path": None,
                "html_path": html_path,
                "html_fallback": True,
                "error": "WeasyPrint not installed",
            }

        try:
            # Generate PDF
            pdf_path = os.path.join(self.output_dir, f"{filename}.pdf")

            html_doc = HTML(string=html_content)

            if css:
                stylesheet = CSS(string=css)
                html_doc.write_pdf(pdf_path, stylesheets=[stylesheet])
            else:
                html_doc.write_pdf(pdf_path)

            return {
                "success": True,
                "pdf_path": pdf_path,
                "html_path": None,
                "html_fallback": False,
                "error": None,
            }
        except Exception as e:
            return {
                "success": False,
                "pdf_path": None,
                "html_path": None,
                "html_fallback": False,
                "error": str(e),
            }

    async def generate_lease_pdf(
        self, html_content: str, property_id: str, tenant_id: str
    ) -> dict:
        """Generate lease PDF with standard naming."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"lease_{property_id[:8]}_{tenant_id[:8]}_{timestamp}"
        return await self.generate_pdf(html_content, filename)

    async def generate_receipt_pdf(
        self, html_content: str, property_id: str, period: str  # "2026-01" format
    ) -> dict:
        """Generate rent receipt PDF with standard naming."""
        filename = f"receipt_{property_id[:8]}_{period.replace('-', '')}"
        return await self.generate_pdf(html_content, filename)


# Singleton instance
pdf_generator = PDFGenerator()
