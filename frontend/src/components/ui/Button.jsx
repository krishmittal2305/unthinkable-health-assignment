export default function Button({
  variant = "primary",
  type = "button",
  block = false,
  disabled = false,
  onClick,
  children,
  ...rest
}) {
  const className = `btn btn-${variant}${block ? " btn-block" : ""}`;
  return (
    <button type={type} className={className} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
