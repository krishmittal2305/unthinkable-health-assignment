export default function AiStatusBanner({ message = "AI summary unavailable — showing default content", action }) {
  return (
    <div className="ai-status-banner">
      <span>{message}</span>
      {action}
    </div>
  );
}
