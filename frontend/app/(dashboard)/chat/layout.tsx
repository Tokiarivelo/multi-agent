export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {children}
    </div>
  );
}
