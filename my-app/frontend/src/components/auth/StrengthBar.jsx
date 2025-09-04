import React from "react";

function scorePassword(pwd = "") {
  let s = 0;
  if (pwd.length >= 8) s += 1;
  if (/[A-Z]/.test(pwd)) s += 1;
  if (/[a-z]/.test(pwd)) s += 1;
  if (/[0-9]/.test(pwd)) s += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) s += 1;
  return Math.min(s, 4); // 0..4
}

export default function StrengthBar({ value }) {
  const score = scorePassword(value);
  const labels = ["Too weak", "Weak", "Okay", "Good", "Strong"]; // 0..4
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[0,1,2,3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded ${i <= score-1 ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-700"}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{labels[score]}</p>
    </div>
  );
}
