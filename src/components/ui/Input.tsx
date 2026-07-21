"use client";

import {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
  forwardRef,
  useId,
} from "react";
import { cn } from "@/lib/utils";

/** Every field auto-generates an id (React useId) so the visible <label> is
 * ALWAYS programmatically associated — callers don't need to pass `id`.
 * Error/hint text gets its own id and is wired via aria-describedby, and
 * `aria-invalid` is set whenever `error` is present. */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  label?: string;
  error?: string;
  /** Helper text under the field. Suppressed while `error` is showing, so the
   * two never stack and compete for the same slot. */
  hint?: ReactNode;
  /** Extra control on the opposite side from `icon` (e.g. a show/hide-password
   * toggle) — rendered inside the field, not just decorative like `icon`. */
  endAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, label, error, hint, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const messageId = `${fieldId}-message`;
    const hasMessage = Boolean(error || hint);
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
            {label}
            {props.required && (
              <span aria-hidden className="text-danger">
                {" *"}
              </span>
            )}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={hasMessage ? messageId : undefined}
            className={cn(
              "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
              icon && "pr-10",
              endAdornment && "pl-10",
              error && "border-danger focus:border-danger focus:ring-danger/20",
              className
            )}
            {...props}
          />
          {endAdornment && (
            <span className="absolute inset-y-0 left-3 flex items-center">{endAdornment}</span>
          )}
        </div>
        {error ? (
          <span id={messageId} className="text-xs text-danger-text">
            {error}
          </span>
        ) : (
          hint && (
            <span id={messageId} className="text-xs text-slate-500">
              {hint}
            </span>
          )
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const messageId = `${fieldId}-message`;
    const hasMessage = Boolean(error || hint);
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
            {label}
            {props.required && (
              <span aria-hidden className="text-danger">
                {" *"}
              </span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={cn(
            "min-h-[80px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
            error && "border-danger focus:border-danger focus:ring-danger/20",
            className
          )}
          {...props}
        />
        {error ? (
          <span id={messageId} className="text-xs text-danger-text">
            {error}
          </span>
        ) : (
          hint && (
            <span id={messageId} className="text-xs text-slate-500">
              {hint}
            </span>
          )
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, children, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const messageId = `${fieldId}-message`;
    const hasMessage = Boolean(error || hint);
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
            {label}
            {props.required && (
              <span aria-hidden className="text-danger">
                {" *"}
              </span>
            )}
          </label>
        )}
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={cn(
            "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
            error && "border-danger focus:border-danger focus:ring-danger/20",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <span id={messageId} className="text-xs text-danger-text">
            {error}
          </span>
        ) : (
          hint && (
            <span id={messageId} className="text-xs text-slate-500">
              {hint}
            </span>
          )
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
