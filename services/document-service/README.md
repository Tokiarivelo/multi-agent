# Document Generation Service

A Python/FastAPI microservice that generates, parses, and manages documents in multiple formats: **PDF, DOCX, XLSX, Markdown, CSV, HTML, TXT, and JSON**. Also provides OCR for images and workspace file operations.

## Stack

| Library | Purpose |
|---------|---------|
| FastAPI + Uvicorn | HTTP server & auto-generated Swagger UI |
| python-docx | DOCX generation |
| openpyxl | XLSX generation |
| reportlab | PDF generation |
| Jinja2 | HTML templating |
| Pydantic v2 | Request validation |
| pdfplumber | PDF parsing |
| pytesseract | OCR for images |
| matplotlib / networkx | Chart and diagram rendering |

## Port

`3009` — proxied by the gateway under `/api/documents/*`

## Swagger UI

Interactive API explorer available at **`http://localhost:3009/docs`** when the service is running.

OpenAPI JSON spec: `http://localhost:3009/openapi.json`

## API

### Health

#### `GET /api/documents/health`
Returns `{ "status": "ok", "service": "document-service" }`.

### Documents

#### `GET /api/documents/formats`
Returns the list of supported formats with MIME types and file extensions.

#### `POST /api/documents/generate`
Generates and streams a file download.

**Request body:**
```json
{
  "format": "pdf",
  "title": "My Report",
  "author": "Jane Doe",
  "sections": [
    { "heading": "Introduction", "body": "This is the intro.", "level": 1 },
    { "heading": "Details", "body": "More content here.", "level": 2 }
  ],
  "table": {
    "headers": ["Name", "Value", "Date"],
    "rows": [
      ["Revenue", "120 000 €", "2024-Q4"],
      ["Costs", "80 000 €", "2024-Q4"]
    ]
  },
  "charts": [
    {
      "type": "bar",
      "title": "Sales",
      "labels": ["Q1", "Q2", "Q3"],
      "datasets": [{ "label": "Revenue", "data": [10, 20, 15] }]
    }
  ],
  "metadata": {
    "subject": "Quarterly report",
    "keywords": "finance, Q4",
    "company": "Acme Corp"
  }
}
```

**Supported `format` values:** `pdf`, `docx`, `xlsx`, `md`, `csv`, `html`, `txt`, `json`

**Response:** Binary file stream with `Content-Disposition: attachment; filename="<title>.<ext>"`.

#### `POST /api/documents/parse`
Parse an uploaded file (`multipart/form-data`). Returns structured text/data extracted from the document.

#### `POST /api/documents/parse-path`
Parse a file from an absolute server-side path.

```json
{ "path": "/workspace/report.pdf", "encoding": "utf-8" }
```

#### `POST /api/documents/parse-image`
OCR an uploaded image (`multipart/form-data`). Returns extracted text and metadata.

#### `POST /api/documents/parse-image-path`
OCR an image from an absolute server-side path.

```json
{ "path": "/workspace/screenshot.png" }
```

### Files

#### `GET /api/documents/read`
Read a plain-text file from the workspace.

| Query param | Description |
|-------------|-------------|
| `path` | Absolute server path to the file |
| `encoding` | Character encoding (default `utf-8`) |

#### `POST /api/documents/write`
Write content to a text file. Falls back to cloud upload (via file-service) when the path is outside the workspace and a `userId` is provided.

```json
{
  "path": "/workspace/notes.md",
  "content": "# My Notes\n\nHello world.",
  "encoding": "utf-8",
  "userId": "optional-for-cloud-fallback"
}
```

#### `POST /api/documents/delete`
Delete a file or directory from the workspace.

```json
{ "path": "/workspace/old-file.txt" }
```

## Running locally

```bash
cd services/document-service
pip install -r requirements.txt
uvicorn main:app --reload --port 3009
```

## Running with Docker

```bash
docker build -t document-service .
docker run -p 3009:3009 document-service
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE_ROOT` | `cwd` | Root directory for all file operations |
| `FILE_SERVICE_URL` | `http://localhost:3008` | URL of the file-service (cloud upload fallback) |
