# Document Generation Service

A Python/FastAPI microservice that generates documents in multiple formats: **PDF, DOCX, XLSX, Markdown, CSV, HTML, TXT, and JSON**.

## Stack

| Library | Purpose |
|---------|---------|
| FastAPI + Uvicorn | HTTP server |
| python-docx | DOCX generation |
| openpyxl | XLSX generation |
| reportlab | PDF generation |
| Jinja2 | HTML templating |
| Pydantic v2 | Request validation |

## Port

`3009` — proxied by the gateway under `/api/documents/*`

## API

### `GET /api/documents/health`
Returns `{ "status": "ok" }`.

### `GET /api/documents/formats`
Returns the list of supported formats with their MIME types and extensions.

### `POST /api/documents/generate`
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
  "metadata": {
    "subject": "Quarterly report",
    "keywords": "finance, Q4",
    "company": "Acme Corp"
  }
}
```

**Supported `format` values:** `pdf`, `docx`, `xlsx`, `md`, `csv`, `html`, `txt`, `json`

**Response:** Binary file stream with `Content-Disposition: attachment; filename="<title>.<ext>"`.

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

Or via docker-compose (infrastructure):

```bash
docker-compose up document-service
```

## Environment variables

None required. The service is stateless — it generates files in memory and streams them.
