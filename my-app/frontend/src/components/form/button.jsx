export default function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "px-4 py-2 rounded-2xl font-medium bg-blue-600 hover:bg-blue-700 text-white shadow " +
        className
      }
    >
      {children}
    </button>
  );
}
