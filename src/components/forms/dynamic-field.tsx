"use client";

import type { FieldType } from "@prisma/client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCustomFieldValue,
  parseFieldOptions,
  type FieldOption,
} from "@/lib/custom-fields";
import { cn } from "@/lib/utils";

export type DynamicFieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: unknown;
  required?: boolean;
  helpText?: string | null;
  placeholder?: string | null;
};

export type DynamicFieldMode = "form" | "filter" | "cell" | "export";

type Props = {
  field: DynamicFieldDef;
  value: unknown;
  onChange?: (value: unknown) => void;
  mode?: DynamicFieldMode;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function DynamicField({
  field,
  value,
  onChange,
  mode = "form",
  disabled,
  className,
  id,
}: Props) {
  const options = parseFieldOptions(field.options);
  const inputId = id ?? `cf-${field.key}`;

  if (mode === "cell" || mode === "export") {
    return (
      <span className={cn("text-sm", className)}>
        {formatCustomFieldValue(field.type, value, options) || "—"}
      </span>
    );
  }

  const isFilter = mode === "filter";
  const showLabel = mode === "form";

  return (
    <div className={cn("space-y-1.5", className)}>
      {showLabel ? (
        <Label htmlFor={inputId}>
          {field.label}
          {field.required ? (
            <span className="text-destructive"> *</span>
          ) : null}
        </Label>
      ) : null}
      {isFilter && !showLabel ? (
        <Label htmlFor={inputId} className="text-xs text-muted-foreground">
          {field.label}
        </Label>
      ) : null}
      <FieldControl
        field={field}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        inputId={inputId}
        isFilter={isFilter}
      />
      {mode === "form" && field.helpText ? (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      ) : null}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  options,
  disabled,
  inputId,
  isFilter,
}: {
  field: DynamicFieldDef;
  value: unknown;
  onChange?: (value: unknown) => void;
  options: FieldOption[];
  disabled?: boolean;
  inputId: string;
  isFilter: boolean;
}) {
  const placeholder = field.placeholder ?? (isFilter ? "Any" : undefined);

  switch (field.type) {
    case "LONG_TEXT":
      return (
        <Textarea
          id={inputId}
          value={stringVal(value)}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={isFilter ? 2 : 3}
        />
      );

    case "NUMBER":
    case "DECIMAL":
      return (
        <Input
          id={inputId}
          type="number"
          step={field.type === "DECIMAL" ? "0.01" : "1"}
          value={value == null || value === "" ? "" : String(value)}
          onChange={(e) =>
            onChange?.(e.target.value === "" ? null : e.target.value)
          }
          disabled={disabled}
          placeholder={placeholder}
        />
      );

    case "DATE":
      return (
        <Input
          id={inputId}
          type="date"
          value={dateInputVal(value)}
          onChange={(e) => onChange?.(e.target.value || null)}
          disabled={disabled}
        />
      );

    case "BOOLEAN":
      return (
        <div className="flex items-center gap-2 pt-1">
          {isFilter ? (
            <Select
              value={boolFilterVal(value)}
              onValueChange={(v) => {
                if (v === "any") onChange?.(null);
                else onChange?.(v === "true");
              }}
              disabled={disabled}
            >
              <SelectTrigger id={inputId} className="w-full">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <>
              <Checkbox
                id={inputId}
                checked={value === true || value === "true"}
                onCheckedChange={(checked) => onChange?.(checked === true)}
                disabled={disabled}
              />
              <Label htmlFor={inputId} className="font-normal">
                Yes
              </Label>
            </>
          )}
        </div>
      );

    case "SELECT":
      return (
        <Select
          value={stringVal(value) || (isFilter ? "__any__" : undefined)}
          onValueChange={(v) => {
            if (v === "__any__") onChange?.(null);
            else onChange?.(v);
          }}
          disabled={disabled}
        >
          <SelectTrigger id={inputId} className="w-full">
            <SelectValue placeholder={placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {isFilter ? (
              <SelectItem value="__any__">Any</SelectItem>
            ) : null}
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "MULTI_SELECT": {
      const selected = Array.isArray(value)
        ? value.map(String)
        : value
          ? [String(value)]
          : [];
      return (
        <div className="flex flex-col gap-1.5 rounded-md border p-2">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground">No options</p>
          ) : (
            options.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(c) => {
                      if (c) onChange?.([...selected, o.value]);
                      else onChange?.(selected.filter((v) => v !== o.value));
                    }}
                  />
                  {o.label}
                </label>
              );
            })
          )}
        </div>
      );
    }

    case "EMAIL":
      return (
        <Input
          id={inputId}
          type="email"
          value={stringVal(value)}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder ?? "name@example.com"}
        />
      );

    case "URL":
      return (
        <Input
          id={inputId}
          type="url"
          value={stringVal(value)}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder ?? "https://"}
        />
      );

    case "PHONE":
    case "TEXT":
    default:
      return (
        <Input
          id={inputId}
          type="text"
          value={stringVal(value)}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      );
  }
}

function stringVal(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function dateInputVal(value: unknown): string {
  if (value == null || value === "") return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function boolFilterVal(value: unknown): string {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "any";
}

/** Format for CSV without React. */
export function exportCustomFieldCell(
  type: FieldType,
  value: unknown,
  options?: unknown,
): string {
  return formatCustomFieldValue(type, value, parseFieldOptions(options));
}
