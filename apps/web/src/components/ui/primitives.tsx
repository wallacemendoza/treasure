import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("card", className)}>{children}</section>;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return <button className={cn("btn", `btn-${variant}`, `btn-${size}`, className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("select", className)} {...props} />;
}

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "success" | "warning" | "danger" | "info" }>) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase())
    .join("");

  if (src) {
    return <img className={cn("avatar", className)} src={src} alt={name} />;
  }

  return <span className={cn("avatar", "avatar-fallback", className)}>{initials || "?"}</span>;
}
