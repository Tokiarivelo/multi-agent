# Document Service — Integration Instructions

## 1. Add to gateway environment

In `services/gateway-service/.env` (or your deployment secrets):

```env
DOCUMENT_SERVICE_URL=http://document-service:3009   # Docker
# or
DOCUMENT_SERVICE_URL=http://localhost:3009           # Local
```

The gateway already includes `DOCUMENT_SERVICE_URL` in `env.validation.ts` with `http://localhost:3009` as default.

## 2. Start the service

**Option A — Python directly:**
```bash
cd services/document-service
pip install -r requirements.txt
python main.py
```

**Option B — Docker Compose:**
```bash
docker-compose up document-service
```

## 3. Test the API

```bash
# Health
curl http://localhost:3000/api/documents/health

# List formats
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/documents/formats

# Generate a PDF
curl -X POST http://localhost:3000/api/documents/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "pdf",
    "title": "Test Report",
    "author": "Admin",
    "sections": [{"heading": "Summary", "body": "This is a test."}]
  }' \
  --output test.pdf

# Generate XLSX with a table
curl -X POST http://localhost:3000/api/documents/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "xlsx",
    "title": "Sales Data",
    "table": {
      "headers": ["Product", "Q1", "Q2"],
      "rows": [["Widget A", 1200, 1500], ["Widget B", 900, 1100]]
    }
  }' \
  --output sales.xlsx
```

## 4. Frontend usage

Navigate to `/documents` in the dashboard. The page provides:
- Format selector (PDF, DOCX, XLSX, MD, CSV, HTML, TXT, JSON)
- Title and author fields
- Section builder (heading + body, configurable heading level)
- Optional data table builder (add/remove rows and columns)
- Optional metadata (subject, keywords, company)
- One-click generate & download

## 5. Adding a new output format

1. Add the format id to `SUPPORTED_FORMATS` in `main.py`
2. Add its MIME type to `MIME_TYPES`
3. Implement a `_generate_<format>(req: GenerateRequest) -> bytes` function
4. Register the function in `GENERATORS`
5. Add an entry in the `list_formats` endpoint response

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 502 from gateway | Service not running | `docker-compose up document-service` |
| `reportlab not installed` | Missing dep | `pip install reportlab` |
| Empty PDF | No sections or table | Add at least one section |
| CORS error | Direct call to port 3009 | Route through gateway at port 3000 |
