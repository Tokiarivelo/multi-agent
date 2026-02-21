import LoginForm from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background relative overflow-hidden">
      {/* Light Mode Gradient & Grid */}
      <div className="absolute inset-0 dark:hidden bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-slate-100 via-background to-background" />
      <div className="absolute inset-0 dark:hidden bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[50px_50px]" />

      {/* Dark Mode Gradient & Grid */}
      <div className="absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black" />
      <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-size-[50px_50px]" />

      <div className="relative z-10 w-full max-w-md px-4">
        <LoginForm />
      </div>
    </div>
  );
}
