export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-gray-600">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
