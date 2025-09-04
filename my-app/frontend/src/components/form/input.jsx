export default function Input({ label, className = "", ...props }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-sm text-gray-200">{label}</span>}
      <input
        {...props}
        className={
          "px-3 py-2 rounded-xl bg-zinc-800/70 border border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-400 " +
          className
        }
      />
    </label>
  );
}
