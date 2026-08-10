import { Card } from "./primitives";

function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="loading-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="error-state">
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try Again
        </button>
      ) : null}
    </Card>
  );
}

export default LoadingSpinner;
