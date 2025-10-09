// src/components/admin/AdminBell.jsx
import { useEffect, useState } from "react";
import axios from "../../utils/axios";

export default function AdminBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    axios
      .get("/api/admin/notifications?status=unseen")
      .then((res) => setCount(res.data.length));
  }, []);
  return (
    <div className="relative">
      <span role="img" aria-label="bell">
        🔔
      </span>
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full px-2 text-xs">
          {count}
        </span>
      )}
    </div>
  );
}
