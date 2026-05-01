export function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast toast--${toast.type || 'success'}`}>{toast.message}</div>;
}
