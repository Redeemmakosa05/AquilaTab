export function Mark() {
  return (
    <span className="brand-mark">
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M3 7l11 5L25 4l-8 18-3-7L3 7z" fill="currentColor" />
      </svg>
    </span>
  );
}
export function Brand() {
  return (
    <a href="/" className="brand">
      <Mark />
      <span>
        Aquila<span>Tab</span>
        <i />
      </span>
    </a>
  );
}
