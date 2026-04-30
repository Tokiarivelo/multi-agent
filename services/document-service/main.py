import io
import os
import re
import csv
import json
from pathlib import Path
from typing import Optional, List, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import httpx

app = FastAPI(
    title="Document Generation Service",
    description="Generate PDF, DOCX, XLSX, MD, CSV, HTML, TXT files",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_FORMATS = ["pdf", "docx", "xlsx", "md", "csv", "html", "txt", "json"]

# Workspace root – all server-side path operations are restricted to this directory.
WORKSPACE_ROOT: str = os.environ.get("WORKSPACE_ROOT", os.getcwd())
FILE_SERVICE_URL: str = os.environ.get("FILE_SERVICE_URL", "http://localhost:3008")

MIME_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "md": "text/markdown",
    "csv": "text/csv",
    "html": "text/html",
    "txt": "text/plain",
    "json": "application/json",
}


class Section(BaseModel):
    heading: Optional[str] = None
    body: Optional[str] = None
    level: Optional[int] = 1


class TableData(BaseModel):
    headers: List[str] = []
    rows: List[List[Any]] = []


class DocumentMetadata(BaseModel):
    subject: Optional[str] = None
    keywords: Optional[str] = None
    company: Optional[str] = None


class GenerateRequest(BaseModel):
    format: str
    title: str = "Document"
    author: Optional[str] = None
    sections: Optional[List[Section]] = None
    table: Optional[TableData] = None
    metadata: Optional[DocumentMetadata] = None


def _generate_pdf(req: GenerateRequest) -> bytes:
    try:
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm)
        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Title"],
            fontSize=22,
            spaceAfter=20,
        )
        h1_style = ParagraphStyle(
            "CustomH1",
            parent=styles["Heading1"],
            fontSize=14,
            spaceAfter=8,
            spaceBefore=16,
        )
        body_style = styles["BodyText"]
        body_style.leading = 16

        story.append(Paragraph(req.title, title_style))
        if req.author:
            story.append(Paragraph(f"Author: {req.author}", styles["Normal"]))
        story.append(Spacer(1, 0.5 * cm))

        for section in req.sections or []:
            if section.heading:
                story.append(Paragraph(section.heading, h1_style))
            if section.body:
                story.append(Paragraph(section.body, body_style))
            story.append(Spacer(1, 0.3 * cm))

        if req.table and req.table.headers:
            table_data = [req.table.headers] + [list(map(str, r)) for r in req.table.rows]
            t = Table(table_data, repeatRows=1)
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 10),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.append(t)

        doc.build(story)
        return buf.getvalue()
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"reportlab not installed: {e}")


def _generate_docx(req: GenerateRequest) -> bytes:
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = Document()
        core = doc.core_properties
        core.title = req.title
        if req.author:
            core.author = req.author
        if req.metadata:
            if req.metadata.subject:
                core.subject = req.metadata.subject
            if req.metadata.keywords:
                core.keywords = req.metadata.keywords
            if req.metadata.company:
                core.company = req.metadata.company

        title_para = doc.add_heading(req.title, level=0)
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        if req.author:
            p = doc.add_paragraph(f"Author: {req.author}")
            p.runs[0].italic = True
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER

        doc.add_paragraph()

        for section in req.sections or []:
            if section.heading:
                doc.add_heading(section.heading, level=section.level or 1)
            if section.body:
                doc.add_paragraph(section.body)

        if req.table and req.table.headers:
            doc.add_paragraph()
            t = doc.add_table(rows=1, cols=len(req.table.headers))
            t.style = "Table Grid"
            hdr = t.rows[0].cells
            for i, h in enumerate(req.table.headers):
                hdr[i].text = str(h)
                run = hdr[i].paragraphs[0].runs[0]
                run.bold = True
                run.font.color.rgb = RGBColor(79, 70, 229)
            for row in req.table.rows:
                cells = t.add_row().cells
                for i, val in enumerate(row):
                    cells[i].text = str(val)

        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"python-docx not installed: {e}")


def _generate_xlsx(req: GenerateRequest) -> bytes:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = Workbook()
        ws = wb.active
        ws.title = req.title[:31]

        wb.properties.title = req.title
        if req.author:
            wb.properties.creator = req.author

        header_font = Font(bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill("solid", fgColor="4F46E5")
        header_align = Alignment(horizontal="center", vertical="center")
        thin = Side(style="thin", color="E2E8F0")
        border = Border(left=thin, right=thin, top=thin, bottom=thin)

        row_offset = 1
        if req.sections:
            for section in req.sections:
                if section.heading:
                    cell = ws.cell(row=row_offset, column=1, value=section.heading)
                    cell.font = Font(bold=True, size=13)
                    row_offset += 1
                if section.body:
                    cell = ws.cell(row=row_offset, column=1, value=section.body)
                    row_offset += 1
                row_offset += 1

        if req.table and req.table.headers:
            for col_idx, header in enumerate(req.table.headers, start=1):
                cell = ws.cell(row=row_offset, column=col_idx, value=header)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_align
                cell.border = border
            row_offset += 1

            alt_fill = PatternFill("solid", fgColor="F1F5F9")
            for r_idx, row in enumerate(req.table.rows):
                fill = alt_fill if r_idx % 2 == 1 else None
                for col_idx, val in enumerate(row, start=1):
                    cell = ws.cell(row=row_offset, column=col_idx, value=val)
                    cell.border = border
                    if fill:
                        cell.fill = fill
                row_offset += 1

            for col_idx in range(1, len(req.table.headers) + 1):
                col_letter = get_column_letter(col_idx)
                ws.column_dimensions[col_letter].width = 18

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"openpyxl not installed: {e}")


def _generate_md(req: GenerateRequest) -> bytes:
    lines = [f"# {req.title}", ""]
    if req.author:
        lines += [f"**Author:** {req.author}", ""]
    if req.metadata:
        if req.metadata.subject:
            lines += [f"**Subject:** {req.metadata.subject}", ""]
    lines.append("---")
    lines.append("")
    for section in req.sections or []:
        if section.heading:
            prefix = "#" * (section.level or 1 + 1)
            lines.append(f"{prefix} {section.heading}")
            lines.append("")
        if section.body:
            lines.append(section.body)
            lines.append("")
    if req.table and req.table.headers:
        lines.append("| " + " | ".join(req.table.headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(req.table.headers)) + " |")
        for row in req.table.rows:
            lines.append("| " + " | ".join(str(v) for v in row) + " |")
        lines.append("")
    return "\n".join(lines).encode("utf-8")


def _generate_csv(req: GenerateRequest) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    if req.table:
        if req.table.headers:
            writer.writerow(req.table.headers)
        for row in req.table.rows:
            writer.writerow(row)
    elif req.sections:
        writer.writerow(["Heading", "Body"])
        for s in req.sections:
            writer.writerow([s.heading or "", s.body or ""])
    return buf.getvalue().encode("utf-8")


def _generate_html(req: GenerateRequest) -> bytes:
    sections_html = ""
    for section in req.sections or []:
        if section.heading:
            level = section.level or 2
            sections_html += f"<h{level}>{section.heading}</h{level}>\n"
        if section.body:
            for para in section.body.split("\n\n"):
                sections_html += f"<p>{para}</p>\n"

    table_html = ""
    if req.table and req.table.headers:
        headers = "".join(f"<th>{h}</th>" for h in req.table.headers)
        rows_html = ""
        for row in req.table.rows:
            cells = "".join(f"<td>{v}</td>" for v in row)
            rows_html += f"<tr>{cells}</tr>\n"
        table_html = f"""
        <table>
          <thead><tr>{headers}</tr></thead>
          <tbody>{rows_html}</tbody>
        </table>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{req.title}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; }}
    h1 {{ color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: .5rem; }}
    h2, h3 {{ color: #334155; }}
    p {{ line-height: 1.7; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 1rem; }}
    th {{ background: #4f46e5; color: #fff; padding: .6rem 1rem; text-align: left; }}
    td {{ padding: .5rem 1rem; border-bottom: 1px solid #e2e8f0; }}
    tr:nth-child(even) td {{ background: #f8fafc; }}
    .meta {{ color: #64748b; font-size: .9rem; margin-bottom: 1.5rem; }}
  </style>
</head>
<body>
  <h1>{req.title}</h1>
  <p class="meta">{f'Author: {req.author}' if req.author else ''}</p>
  {sections_html}
  {table_html}
</body>
</html>"""
    return html.encode("utf-8")


def _generate_txt(req: GenerateRequest) -> bytes:
    lines = [req.title, "=" * len(req.title), ""]
    if req.author:
        lines += [f"Author: {req.author}", ""]
    for section in req.sections or []:
        if section.heading:
            lines += [section.heading, "-" * len(section.heading)]
        if section.body:
            lines.append(section.body)
        lines.append("")
    if req.table and req.table.headers:
        col_widths = [max(len(str(h)), *(len(str(r[i])) for r in req.table.rows), 0) + 2 for i, h in enumerate(req.table.headers)]
        header_row = " | ".join(str(h).ljust(col_widths[i]) for i, h in enumerate(req.table.headers))
        lines.append(header_row)
        lines.append("-" * len(header_row))
        for row in req.table.rows:
            lines.append(" | ".join(str(v).ljust(col_widths[i]) for i, v in enumerate(row)))
    return "\n".join(lines).encode("utf-8")


def _generate_json_doc(req: GenerateRequest) -> bytes:
    data = {
        "title": req.title,
        "author": req.author,
        "sections": [s.model_dump() for s in (req.sections or [])],
        "table": req.table.model_dump() if req.table else None,
        "metadata": req.metadata.model_dump() if req.metadata else None,
    }
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


GENERATORS = {
    "pdf": _generate_pdf,
    "docx": _generate_docx,
    "xlsx": _generate_xlsx,
    "md": _generate_md,
    "csv": _generate_csv,
    "html": _generate_html,
    "txt": _generate_txt,
    "json": _generate_json_doc,
}


@app.get("/api/documents/health")
def health():
    return {"status": "ok", "service": "document-service"}


@app.get("/api/documents/formats")
def list_formats():
    return {
        "formats": [
            {"id": "pdf", "label": "PDF", "mime": MIME_TYPES["pdf"], "ext": ".pdf"},
            {"id": "docx", "label": "Word (DOCX)", "mime": MIME_TYPES["docx"], "ext": ".docx"},
            {"id": "xlsx", "label": "Excel (XLSX)", "mime": MIME_TYPES["xlsx"], "ext": ".xlsx"},
            {"id": "md", "label": "Markdown", "mime": MIME_TYPES["md"], "ext": ".md"},
            {"id": "csv", "label": "CSV", "mime": MIME_TYPES["csv"], "ext": ".csv"},
            {"id": "html", "label": "HTML", "mime": MIME_TYPES["html"], "ext": ".html"},
            {"id": "txt", "label": "Plain Text", "mime": MIME_TYPES["txt"], "ext": ".txt"},
            {"id": "json", "label": "JSON", "mime": MIME_TYPES["json"], "ext": ".json"},
        ]
    }


@app.post("/api/documents/generate")
def generate_document(req: GenerateRequest):
    fmt = req.format.lower()
    if fmt not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{fmt}'. Supported: {', '.join(SUPPORTED_FORMATS)}",
        )

    generator = GENERATORS[fmt]
    content = generator(req)

    safe_title = "".join(c if c.isalnum() or c in "._- " else "_" for c in req.title).strip()
    filename = f"{safe_title or 'document'}.{fmt}"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=MIME_TYPES[fmt],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Parse models ────────────────────────────────────────────────────────────

class ParsePathRequest(BaseModel):
    path: str
    encoding: Optional[str] = "utf-8"


class ParseImagePathRequest(BaseModel):
    path: str


class WriteFileRequest(BaseModel):
    path: str
    content: str
    encoding: Optional[str] = "utf-8"
    userId: Optional[str] = None


class DeleteFileRequest(BaseModel):
    path: str


# ─── Parse helpers ────────────────────────────────────────────────────────────

def _safe_workspace_path(file_path: str, check_exists: bool = True) -> str:
    """Resolve *file_path* inside WORKSPACE_ROOT and reject escapes via symlinks / '..'."""
    path, is_safe = _resolve_path(file_path)
    if not is_safe:
        raise HTTPException(
            status_code=403,
            detail="Access denied: path is outside the allowed workspace root",
        )
    if check_exists and not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    return path


def _resolve_path(file_path: str) -> tuple[str, bool]:
    """Resolve *file_path* and check if it is within WORKSPACE_ROOT."""
    if os.path.isabs(file_path):
        candidate = file_path
    else:
        candidate = os.path.join(WORKSPACE_ROOT, file_path)

    real_root = os.path.realpath(WORKSPACE_ROOT)
    real_candidate = os.path.realpath(candidate)

    is_safe = real_candidate.startswith(real_root + os.sep) or real_candidate == real_root
    return real_candidate, is_safe


async def _upload_to_cloud(
    filename: str,
    content: bytes,
    user_id: str,
    mime_type: str = "text/plain",
) -> dict:
    """Upload content to cloud storage using presigned PUT URL (best practice).

    Two-step flow:
    1. POST /api/files/initiate-upload → receives presigned PUT URL + file record.
    2. PUT bytes directly to MinIO via presigned URL (no buffering through file-service).
    """
    async with httpx.AsyncClient() as http:
        # Step 1: initiate upload — get presigned PUT URL
        init_resp = await http.post(
            f"{FILE_SERVICE_URL}/api/files/initiate-upload",
            params={"userId": user_id},
            json={"originalName": filename, "mimeType": mime_type, "size": len(content)},
            timeout=15.0,
        )
        if not init_resp.is_success:
            raise HTTPException(
                status_code=init_resp.status_code,
                detail=f"Cloud upload initiation failed: {init_resp.text}",
            )
        data = init_resp.json()
        upload_url: str = data["uploadUrl"]
        record: dict = data["record"]

        # Step 2: PUT bytes directly to MinIO presigned URL (bypasses file-service buffer)
        put_resp = await http.put(
            upload_url,
            content=content,
            headers={"Content-Type": mime_type},
            timeout=60.0,
        )
        if not put_resp.is_success:
            raise HTTPException(
                status_code=put_resp.status_code,
                detail=f"Cloud upload PUT failed: {put_resp.text}",
            )

    return {"url": record["url"], "fileId": record.get("id", ""), "storedAs": record.get("storedName", filename)}


def _detect_ext(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")


def _parse_pdf_bytes(content: bytes) -> dict:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        return {"type": "pdf", "text": "\n\n".join(pages), "pages": len(pages)}
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber not installed")


def _parse_docx_bytes(content: bytes) -> dict:
    try:
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        tables = [
            [[cell.text for cell in row.cells] for row in table.rows]
            for table in doc.tables
        ]
        return {"type": "docx", "text": "\n".join(paragraphs), "paragraphs": paragraphs, "tables": tables}
    except ImportError:
        raise HTTPException(status_code=500, detail="python-docx not installed")


def _parse_xlsx_bytes(content: bytes) -> dict:
    try:
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(content), data_only=True)
        sheets: dict = {}
        for name in wb.sheetnames:
            ws = wb[name]
            sheets[name] = [
                [str(cell.value) if cell.value is not None else "" for cell in row]
                for row in ws.iter_rows()
            ]
        return {"type": "xlsx", "sheets": sheets}
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")


def _parse_csv_bytes(content: bytes, encoding: str) -> dict:
    text = content.decode(encoding, errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    headers = rows[0] if rows else []
    data = rows[1:] if len(rows) > 1 else []
    return {"type": "csv", "headers": headers, "rows": data, "row_count": len(data)}


def _parse_html_bytes(content: bytes, encoding: str) -> dict:
    text = content.decode(encoding, errors="replace")
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(text, "html.parser")
        plain = soup.get_text(separator="\n", strip=True)
        title_tag = soup.find("title")
        return {"type": "html", "text": plain, "title": title_tag.get_text() if title_tag else None}
    except ImportError:
        plain = re.sub(r"<[^>]+>", " ", text)
        plain = re.sub(r"\s+", " ", plain).strip()
        return {"type": "html", "text": plain, "title": None}


def _parse_file_bytes(filename: str, content: bytes, encoding: str = "utf-8") -> dict:
    ext = _detect_ext(filename)
    if ext == "pdf":
        return _parse_pdf_bytes(content)
    if ext == "docx":
        return _parse_docx_bytes(content)
    if ext in ("xlsx", "xls"):
        return _parse_xlsx_bytes(content)
    if ext == "csv":
        return _parse_csv_bytes(content, encoding)
    if ext == "json":
        raw = content.decode(encoding, errors="replace")
        return {"type": "json", "data": json.loads(raw), "raw": raw}
    if ext in ("html", "htm"):
        return _parse_html_bytes(content, encoding)
    # txt, md, and everything else
    text = content.decode(encoding, errors="replace")
    return {"type": ext or "text", "text": text, "length": len(text)}


def _parse_image_bytes(content: bytes, filename: str) -> dict:
    try:
        from PIL import Image as PilImage
        img = PilImage.open(io.BytesIO(content))
        result: dict = {
            "type": "image",
            "format": img.format,
            "mode": img.mode,
            "width": img.width,
            "height": img.height,
            "filename": filename,
        }
        try:
            import pytesseract
            result["ocr_text"] = pytesseract.image_to_string(img).strip()
        except Exception:
            result["ocr_text"] = None
            result["ocr_note"] = "OCR unavailable — tesseract not installed or image unreadable"
        return result
    except ImportError:
        raise HTTPException(status_code=500, detail="Pillow not installed")


# ─── Parse endpoints ──────────────────────────────────────────────────────────

@app.post("/api/documents/parse")
async def parse_document_upload(file: UploadFile = File(...)):
    """Parse an uploaded file and return structured text/data."""
    content = await file.read()
    try:
        result = _parse_file_bytes(file.filename or "unknown", content)
        return {"success": True, "filename": file.filename, **result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/documents/parse-path")
def parse_document_path(req: ParsePathRequest):
    """Parse a file from an absolute server-side path."""
    path = _safe_workspace_path(req.path)
    with open(path, "rb") as f:
        content = f.read()
    try:
        result = _parse_file_bytes(os.path.basename(path), content, req.encoding or "utf-8")
        return {"success": True, "path": path, **result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/documents/parse-image")
async def parse_image_upload(file: UploadFile = File(...)):
    """Parse an uploaded image (OCR + metadata)."""
    content = await file.read()
    try:
        result = _parse_image_bytes(content, file.filename or "unknown")
        return {"success": True, "filename": file.filename, **result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/documents/parse-image-path")
def parse_image_path_endpoint(req: ParseImagePathRequest):
    """Parse an image from an absolute server-side path (OCR + metadata)."""
    path = _safe_workspace_path(req.path)
    with open(path, "rb") as f:
        content = f.read()
    try:
        result = _parse_image_bytes(content, os.path.basename(path))
        return {"success": True, "path": path, **result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/api/documents/read")
def read_text_file(
    path: str = Query(..., description="Absolute server path to a text file"),
    encoding: str = Query("utf-8"),
):
    """Read a plain-text file and return its content."""
    safe_path = _safe_workspace_path(path)
    try:
        with open(safe_path, "r", encoding=encoding, errors="replace") as f:
            content = f.read()
        return {
            "success": True,
            "path": safe_path,
            "content": content,
            "size": os.path.getsize(safe_path),
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/documents/write")
async def write_text_file(req: WriteFileRequest):
    """Write a plain-text file to the workspace or cloud if outside."""
    path, is_safe = _resolve_path(req.path)

    if not is_safe:
        if not req.userId:
            raise HTTPException(
                status_code=403,
                detail="Access denied: path is outside workspace and no userId provided for cloud upload",
            )
        enc = req.encoding or "utf-8"
        content_bytes = req.content.encode(enc)
        upload = await _upload_to_cloud(os.path.basename(path), content_bytes, req.userId)
        return {
            "success": True,
            "path": path,
            "url": upload["url"],
            "fileId": upload["fileId"],
            "storedAs": upload["storedAs"],
            "type": "cloud",
            "size": len(content_bytes),
        }

    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding=req.encoding or "utf-8") as f:
            f.write(req.content)
        return {
            "success": True,
            "path": path,
            "type": "local",
            "size": len(req.content),
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/documents/delete")
def delete_workspace_file(req: DeleteFileRequest):
    """Delete a file from the workspace."""
    safe_path = _safe_workspace_path(req.path, check_exists=True)
    try:
        if os.path.isdir(safe_path):
            import shutil
            shutil.rmtree(safe_path)
        else:
            os.remove(safe_path)
        return {"success": True, "path": safe_path}
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


from logger import get_nest_log_config, get_logger

logger = get_logger("Bootstrap")

if __name__ == "__main__":
    logger.info("🚀 Document Service is starting on: http://0.0.0.0:3009")
    uvicorn.run("main:app", host="0.0.0.0", port=3009, reload=False, log_config=get_nest_log_config())
