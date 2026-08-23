export default function Tag({ variant = "neutral", children }) {
  return <span className={`tag tag-${variant}`}>{children}</span>;
}
