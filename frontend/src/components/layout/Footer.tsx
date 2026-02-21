export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background py-4 px-6 z-10 shrink-0">
      <div className="text-center text-sm font-medium text-muted-foreground/60">
        © {new Date().getFullYear()} Multi-Agent Platform. All rights reserved.
      </div>
    </footer>
  );
}
