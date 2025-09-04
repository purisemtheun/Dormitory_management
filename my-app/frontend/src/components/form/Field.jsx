export default function Field({
  id, label, type="text", value, onChange, placeholder, error, right, autoComplete
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className={`relative`}>
        <input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-xl border px-4 py-3 pr-20"
          aria-invalid={!!error}
        />
        {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
