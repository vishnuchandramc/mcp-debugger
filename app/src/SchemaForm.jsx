import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function SchemaForm({ schema, values, onChange }) {
  if (!schema || !schema.properties) return null;

  const required = schema.required || [];
  const entries = Object.entries(schema.properties);

  function handleChange(key, prop, rawValue) {
    let value = rawValue;
    if (prop.type === 'number') value = rawValue === '' ? '' : Number(rawValue);
    else if (prop.type === 'integer') value = rawValue === '' ? '' : parseInt(rawValue, 10);
    else if (prop.type === 'boolean') value = rawValue;
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 p-0.5">
      {entries.map(([key, prop]) => {
        const isRequired = required.includes(key);
        const value = values[key] ?? (prop.type === 'boolean' ? false : '');

        return (
          <div key={key} className={cn("flex flex-col gap-1 border-l-2 pl-2", isRequired ? "border-zinc-100" : "border-transparent")}>
            <label className="text-zinc-200 text-[11px] font-semibold">
              {key}
              {isRequired && <span className="text-red-400 font-normal"> *</span>}
            </label>
            {prop.description && <span className="text-zinc-500 text-[10px]">{prop.description}</span>}
            {renderInput(key, prop, value, handleChange)}
          </div>
        );
      })}
    </div>
  );
}

function renderInput(key, prop, value, handleChange) {
  if (prop.type === 'string' && prop.enum) {
    return (
      <Select value={value} onValueChange={(val) => handleChange(key, prop, val)}>
        <SelectTrigger className="w-full h-6 text-xs bg-transparent border-zinc-800 text-zinc-200">
          <SelectValue placeholder="— select —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="" className="text-xs">— select —</SelectItem>
          {prop.enum.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (prop.type === 'boolean') {
    return (
      <div className="flex items-center gap-1.5 py-0.5">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => handleChange(key, prop, e.target.checked)}
          className="accent-zinc-700 w-3.5 h-3.5 cursor-pointer m-0"
        />
        <span className="text-zinc-400 text-[11px]">{value ? 'true' : 'false'}</span>
      </div>
    );
  }

  if (prop.type === 'number' || prop.type === 'integer') {
    return (
      <Input
        type="number"
        step={prop.type === 'integer' ? 1 : 'any'}
        className="w-full h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
        value={value}
        onChange={(e) => handleChange(key, prop, e.target.value)}
        placeholder={prop.type}
      />
    );
  }

  // default: string text input
  return (
    <Input
      type="text"
      className="w-full h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
      value={value}
      onChange={(e) => handleChange(key, prop, e.target.value)}
      placeholder={prop.type || 'string'}
    />
  );
}

