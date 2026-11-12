import Icon from "./Icon";
import Switch from "./Switch";
import SuggestInput from "./SuggestInput";
import type { KeyValue } from "../types";
import type { Suggestion } from "../utils/headerSuggestions";
import { newKeyValue } from "../utils/factory";

interface KeyValueEditorProps {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  suggest?: { keys: Suggestion[]; values: (key: string) => Suggestion[] };
}

/** iOS grouped-list editor for params / headers / form fields. */
export default function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  suggest,
}: KeyValueEditorProps) {
  const update = (id: string, patch: Partial<KeyValue>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const add = () => onChange([...rows, newKeyValue()]);

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-ios flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {rows.length === 0 && (
          <p className="py-8 text-center text-[13px] text-label2">
            暂无条目，点击「添加」新建一行。
          </p>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className={`flex items-center gap-2 rounded-lg bg-fill2 px-2 py-1.5 transition ${
              row.enabled ? "" : "opacity-50"
            }`}
          >
            <Switch
              checked={row.enabled}
              onChange={(enabled) => update(row.id, { enabled })}
              label="启用 / 禁用"
            />
            {suggest ? (
              <SuggestInput
                className="min-w-0 flex-1"
                label={keyPlaceholder}
                placeholder={keyPlaceholder}
                value={row.key}
                onChange={(key) => update(row.id, { key })}
                suggestions={suggest.keys}
              />
            ) : (
              <input
                className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-label outline-none placeholder:text-label3"
                placeholder={keyPlaceholder}
                value={row.key}
                onChange={(e) => update(row.id, { key: e.target.value })}
              />
            )}
            <span className="h-4 w-px bg-separator/40" />
            {suggest ? (
              <SuggestInput
                className="min-w-0 flex-[2]"
                label={valuePlaceholder}
                placeholder={valuePlaceholder}
                value={row.value}
                onChange={(value) => update(row.id, { value })}
                suggestions={suggest.values(row.key)}
              />
            ) : (
              <input
                className="min-w-0 flex-[2] bg-transparent font-mono text-[12px] text-label outline-none placeholder:text-label3"
                placeholder={valuePlaceholder}
                value={row.value}
                onChange={(e) => update(row.id, { value: e.target.value })}
              />
            )}
            <button
              className="icon-btn h-6 w-6 text-red hover:bg-red/10 hover:text-red"
              onClick={() => remove(row.id)}
              title="删除该行"
            >
              <Icon name="minus" size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--hairline)] px-3 py-2">
        <button className="btn-plain text-[13px]" onClick={add}>
          <Icon name="plus" size={14} />
          添加
        </button>
      </div>
    </div>
  );
}