FROM rust:1.85-slim-bookworm AS builder

# build-essential provides gcc/cc needed by rquickjs (embeds QuickJS C sources)
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies — build a stub binary first so real source changes
# don't re-download crates.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/tool_sandbox*

COPY src ./src
RUN cargo build --release

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/tool-sandbox /usr/local/bin/tool-sandbox

EXPOSE 3030

CMD ["/usr/local/bin/tool-sandbox"]
