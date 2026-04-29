# syntax=docker/dockerfile:1

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Cache dependency downloads separately from source builds.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build a statically linked binary.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /gateway ./cmd/server

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.20

# ca-certificates needed for TLS connections to upstream services.
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /gateway .

EXPOSE 3020

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --spider -q http://localhost:${PORT:-3020}/health || exit 1

CMD ["./gateway"]
