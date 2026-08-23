export default function Button({
  variant = "solid",
  tone = "blue",
  type = "button",
  disabled = false,
  onClick,
  children,
  ...rest
}) {
  const variantClass = variant === "solid" ? `btn-${tone}` : `btn-${variant}`;
  return (
    <button
      type={type}
      className={`btn ${variantClass}`}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
