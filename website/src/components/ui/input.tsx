import * as React from "react";
import { cn } from "@/lib/utils";

/** Input — height 52px, radius 14px, focus laranja (doc 06 / 07). */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-[52px] w-full rounded-[--radius-input] border border-gray-200 bg-white px-4 text-base text-dark placeholder:text-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-50 aria-[invalid=true]:border-error",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      "w-full rounded-[--radius-input] border border-gray-200 bg-white px-4 py-3 text-base text-dark placeholder:text-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-50 aria-[invalid=true]:border-error resize-y",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  className,
  children,
  htmlFor,
  required,
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor: string;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-medium text-dark", className)}
    >
      {children}
      {required && <span className="ml-0.5 text-primary">*</span>}
    </label>
  );
}
