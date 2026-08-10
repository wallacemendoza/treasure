import type { PropsWithChildren, ReactNode } from "react";
import { Button, Card } from "./primitives";

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
}: PropsWithChildren<{ open: boolean; title: string; footer?: ReactNode; onClose: () => void }>) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <Card className="modal-card">
        <div className="modal-header">
          <h2>{title}</h2>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Close dialog">
            Close
          </Button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </Card>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Working..." : confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
