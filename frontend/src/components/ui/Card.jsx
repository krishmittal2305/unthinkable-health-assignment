export default function Card({ children, style, ...rest }) {
  return (
    <div className="ui-card" style={style} {...rest}>
      {children}
    </div>
  );
}
