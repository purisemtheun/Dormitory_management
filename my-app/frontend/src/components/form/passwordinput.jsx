import { useState } from "react";

export default function PasswordInput({ label, className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-sm text-gray-200">{label}</span>}
      <div className="relative">
        <input
          {...props}
          type={show ? "text" : "password"}
          className={
            "w-full px-3 py-2 rounded-xl bg-zinc-800/70 border border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-400 pr-14 " +
            className
          }
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-lg bg-zinc-700/60 hover:bg-zinc-700 text-zinc-100"
        >
          {show ? "ซ่อน" : "แสดง"}
        </button>
      </div>
    </label>
  );
}
