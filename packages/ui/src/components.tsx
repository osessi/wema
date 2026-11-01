import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

// Composants de base, sans texte en dur : tout libellé est passé par l'appelant
// (traductions de l'application).

const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "w-btn",
        `w-btn--${variant}`,
        size === "sm" && "w-btn--sm",
        block && "w-btn--block",
        className,
      )}
      {...rest}
    />
  );
}

interface FieldShell {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className="w-field">
      <label className="w-field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error ? <span className="w-field__hint">{hint}</span> : null}
      {error ? (
        <span className="w-field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...rest
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className={cx("w-input", className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  ...rest
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        className={cx("w-textarea", className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={cx("w-select", className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
}

export function Checkbox({
  label,
  hint,
  ...rest
}: { label: ReactNode; hint?: ReactNode } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>) {
  return (
    <label className="w-check">
      <input type="checkbox" {...rest} />
      <span>
        {label}
        {hint ? (
          <span className="w-field__hint" style={{ display: "block" }}>
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="w-card">
      {title || actions ? (
        <div
          className="w-row"
          style={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div>
            {title ? <h2 className="w-card__title">{title}</h2> : null}
            {subtitle ? <p className="w-card__subtitle">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({
  tone = "blue",
  children,
}: {
  tone?: "blue" | "orange" | "green" | "grey";
  children: ReactNode;
}) {
  return (
    <span className={cx("w-badge", tone !== "blue" && `w-badge--${tone}`)}>
      {children}
    </span>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      className={cx("w-alert", tone !== "info" && `w-alert--${tone}`)}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="w-empty">{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="w-page-header">
      <div>
        {breadcrumb ? <div className="w-breadcrumb">{breadcrumb}</div> : null}
        <h1 className="w-page-header__title">{title}</h1>
        {subtitle ? (
          <p className="w-page-header__subtitle">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="w-row">{actions}</div> : null}
    </header>
  );
}

export function Table({
  head,
  children,
}: {
  head: ReactNode[];
  children: ReactNode;
}) {
  return (
    <div className="w-table-wrap">
      <table className="w-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: en-têtes fixes, dans l'ordre
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="w-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="w-tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
