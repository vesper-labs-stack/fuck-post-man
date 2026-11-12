import { useEffect, useState } from "react";
import Icon from "./Icon";
import { useAppStore } from "../store/useAppStore";
import {
  vaultDelete,
  vaultGet,
  vaultSet,
  vaultStatus,
} from "../services/apiService";
import { uid } from "../utils/helpers";

interface EnvironmentManagerProps {
  onClose: () => void;
}

interface VariableRow {
  id: string;
  key: string;
  value: string;
}

export default function EnvironmentManager({ onClose }: EnvironmentManagerProps) {
  const environments = useAppStore((s) => s.environments);
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId);
  const addEnvironment = useAppStore((s) => s.addEnvironment);
  const updateEnvironment = useAppStore((s) => s.updateEnvironment);
  const deleteEnvironment = useAppStore((s) => s.deleteEnvironment);
  const setActiveEnvironment = useAppStore((s) => s.setActiveEnvironment);
  const secrets = useAppStore((s) => s.secrets);
  const addSecret = useAppStore((s) => s.addSecret);
  const renameSecret = useAppStore((s) => s.renameSecret);
  const deleteSecret = useAppStore((s) => s.deleteSecret);

  const [mode, setMode] = useState<"env" | "secrets">("env");
  const [selectedId, setSelectedId] = useState<string | null>(
    activeEnvironmentId ?? environments[0]?.id ?? null,
  );
  const [newName, setNewName] = useState("");
  const [rows, setRows] = useState<VariableRow[]>([]);

  const [selectedSecretId, setSelectedSecretId] = useState<string | null>(null);
  const [newSecretName, setNewSecretName] = useState("");
  const [secretNameDraft, setSecretNameDraft] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [secretStatus, setSecretStatus] = useState<Record<string, boolean>>({});
  const [secretError, setSecretError] = useState<string | null>(null);
  const [secretMsg, setSecretMsg] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const selected = environments.find((e) => e.id === selectedId);
  const selectedSecret = secrets.find((s) => s.id === selectedSecretId);
  const secretSaved = selectedSecret
    ? !!secretStatus[selectedSecret.name]
    : false;

  useEffect(() => {
    const env = useAppStore
      .getState()
      .environments.find((e) => e.id === selectedId);
    setRows(
      env
        ? Object.entries(env.variables).map(([key, value]) => ({
            id: uid(),
            key,
            value,
          }))
        : [],
    );
  }, [selectedId]);

  useEffect(() => {
    setSecretValue("");
    setSecretError(null);
    setSecretMsg(null);
    const meta = useAppStore
      .getState()
      .secrets.find((s) => s.id === selectedSecretId);
    setSecretNameDraft(meta?.name ?? "");
  }, [selectedSecretId]);

  const refreshSecretStatus = async () => {
    const names = useAppStore.getState().secrets.map((s) => s.name);
    try {
      setSecretStatus(await vaultStatus(names));
    } catch {
      setSecretStatus({});
    }
  };

  useEffect(() => {
    if (mode !== "secrets") return;
    void refreshSecretStatus();
    const state = useAppStore.getState();
    if (!selectedSecretId && state.secrets.length > 0) {
      setSelectedSecretId(state.secrets[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, secrets]);

  const commitRows = (next: VariableRow[]) => {
    setRows(next);
    if (!selected) return;
    const variables: Record<string, string> = {};
    for (const row of next) {
      if (row.key.trim()) variables[row.key.trim()] = row.value;
    }
    updateEnvironment(selected.id, { variables });
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addEnvironment(name);
    const envs = useAppStore.getState().environments;
    setSelectedId(envs[envs.length - 1].id);
    setNewName("");
  };

  const handleDelete = (id: string) => {
    deleteEnvironment(id);
    if (selectedId === id) {
      const envs = useAppStore.getState().environments;
      setSelectedId(envs[0]?.id ?? null);
    }
  };

  const handleAddSecret = () => {
    const name = newSecretName.trim();
    if (!name) return;
    if (secrets.some((s) => s.name === name)) {
      setSecretError("已存在同名机密变量");
      return;
    }
    const id = addSecret(name);
    setSelectedSecretId(id);
    setNewSecretName("");
    setSecretError(null);
  };

  const handleSaveSecret = async () => {
    if (!selectedSecret) return;
    if (!secretValue) {
      setSecretError("请先输入要保存的值");
      return;
    }
    try {
      await vaultSet(selectedSecret.name, secretValue);
      setSecretValue("");
      setSecretError(null);
      setSecretMsg("已存入系统安全存储");
      window.setTimeout(() => setSecretMsg(null), 2000);
      void refreshSecretStatus();
    } catch (e) {
      setSecretError(e instanceof Error ? e.message : String(e));
    }
  };

  const commitSecretName = async () => {
    if (!selectedSecret) return;
    const name = secretNameDraft.trim();
    if (!name || name === selectedSecret.name) {
      setSecretNameDraft(selectedSecret.name);
      return;
    }
    if (secrets.some((s) => s.name === name && s.id !== selectedSecret.id)) {
      setSecretError("已存在同名机密变量");
      setSecretNameDraft(selectedSecret.name);
      return;
    }
    try {
      const existing = await vaultGet(selectedSecret.name);
      if (existing !== null) {
        await vaultSet(name, existing);
        await vaultDelete(selectedSecret.name);
      }
      renameSecret(selectedSecret.id, name);
      setSecretError(null);
      void refreshSecretStatus();
    } catch (e) {
      setSecretError(e instanceof Error ? e.message : String(e));
      setSecretNameDraft(selectedSecret.name);
    }
  };

  const handleDeleteSecret = async (id: string) => {
    const meta = useAppStore.getState().secrets.find((s) => s.id === id);
    if (!meta) return;
    try {
      await vaultDelete(meta.name);
    } catch (e) {
      setSecretError(e instanceof Error ? e.message : String(e));
      return;
    }
    deleteSecret(id);
    if (selectedSecretId === id) setSelectedSecretId(null);
    void refreshSecretStatus();
  };

  const copySecretRef = async () => {
    if (!selectedSecret) return;
    const text = `{{vault.${selectedSecret.name}}}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopiedRef(true);
    window.setTimeout(() => setCopiedRef(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex h-[540px] w-[780px] animate-sheet-in overflow-hidden rounded-2xl bg-surface shadow-ios-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left list: environments or secrets */}
        <div className="flex w-60 shrink-0 flex-col border-r border-[var(--hairline)] bg-surface2">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h2 className="text-[15px] font-semibold text-label">
              {mode === "env" ? "环境" : "Secrets"}
            </h2>
            <button className="icon-btn" onClick={onClose} title="关闭">
              <Icon name="xmark" size={14} />
            </button>
          </div>
          <div className="px-2 pb-2">
            <div className="seg flex w-full">
              <button
                className={`seg-item flex-1 ${
                  mode === "env" ? "seg-item-active" : "hover:text-label"
                }`}
                onClick={() => setMode("env")}
              >
                环境
              </button>
              <button
                className={`seg-item flex-1 ${
                  mode === "secrets" ? "seg-item-active" : "hover:text-label"
                }`}
                onClick={() => setMode("secrets")}
              >
                Secrets
              </button>
            </div>
          </div>

          {mode === "env" ? (
            <>
              <div className="scroll-ios flex-1 space-y-0.5 overflow-y-auto px-2">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    className={`row-ios group cursor-pointer ${
                      env.id === selectedId ? "bg-accent/15" : ""
                    }`}
                    onClick={() => setSelectedId(env.id)}
                  >
                    <Icon name="globe" size={15} className="shrink-0 text-accent" />
                    <span className="flex-1 truncate text-[13px] text-label">
                      {env.name}
                    </span>
                    {env.id === activeEnvironmentId && (
                      <Icon name="checkmark" size={14} className="shrink-0 text-green" />
                    )}
                    <button
                      className="icon-btn h-6 w-6 text-red opacity-0 hover:bg-red/10 hover:text-red group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(env.id);
                      }}
                      title="删除环境"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 border-t border-[var(--hairline)] p-2">
                <input
                  className="field-ios h-8 flex-1 text-[12px]"
                  placeholder="新环境名称"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <button className="btn-primary h-8 px-2.5" onClick={handleAdd} title="添加环境">
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="scroll-ios flex-1 space-y-0.5 overflow-y-auto px-2">
                {secrets.length === 0 && (
                  <p className="px-2 py-3 text-[12px] leading-relaxed text-label3">
                    还没有机密变量。添加后可在请求中用 {"{{vault.名称}}"} 引用。
                  </p>
                )}
                {secrets.map((s) => (
                  <div
                    key={s.id}
                    className={`row-ios group cursor-pointer ${
                      s.id === selectedSecretId ? "bg-accent/15" : ""
                    }`}
                    onClick={() => setSelectedSecretId(s.id)}
                  >
                    <Icon name="lock" size={14} className="shrink-0 text-indigo" />
                    <span className="flex-1 truncate font-mono text-[12px] text-label">
                      {s.name}
                    </span>
                    {secretStatus[s.name] && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-green"
                        title="已存入系统安全存储"
                      />
                    )}
                    <button
                      className="icon-btn h-6 w-6 text-red opacity-0 hover:bg-red/10 hover:text-red group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteSecret(s.id);
                      }}
                      title="删除机密变量"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 border-t border-[var(--hairline)] p-2">
                <input
                  className="field-ios h-8 flex-1 font-mono text-[12px]"
                  placeholder="新变量名，如 api_token"
                  value={newSecretName}
                  onChange={(e) => setNewSecretName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSecret()}
                />
                <button
                  className="btn-primary h-8 px-2.5"
                  onClick={handleAddSecret}
                  title="添加机密变量"
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right editor */}
        {mode === "env" ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
              {selected ? (
                <input
                  className="field-ios h-8 w-52 text-[14px] font-semibold"
                  value={selected.name}
                  onChange={(e) =>
                    updateEnvironment(selected.id, { name: e.target.value })
                  }
                />
              ) : (
                <span className="text-[13px] text-label2">未选择环境</span>
              )}
              <div className="flex items-center gap-2">
                {selected && selected.id !== activeEnvironmentId && (
                  <button
                    className="btn-plain text-[12px]"
                    onClick={() => setActiveEnvironment(selected.id)}
                  >
                    <Icon name="checkmark" size={13} />
                    设为当前
                  </button>
                )}
                <button className="btn-primary h-8" onClick={onClose}>
                  完成
                </button>
              </div>
            </div>

            {selected ? (
              <>
                <div className="grid grid-cols-[1fr_2fr_auto] gap-2 px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-label2">
                  <span>变量名</span>
                  <span>值</span>
                  <span />
                </div>
                <div className="scroll-ios flex-1 space-y-1.5 overflow-y-auto px-4 py-2">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[1fr_2fr_auto] items-center gap-2 rounded-lg bg-fill2 px-2 py-1.5"
                    >
                      <input
                        className="min-w-0 bg-transparent font-mono text-[12px] text-label outline-none placeholder:text-label3"
                        placeholder="baseUrl"
                        value={row.key}
                        onChange={(e) =>
                          commitRows(
                            rows.map((r) =>
                              r.id === row.id ? { ...r, key: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <input
                        className="min-w-0 bg-transparent font-mono text-[12px] text-label outline-none placeholder:text-label3"
                        placeholder="https://api.example.com"
                        value={row.value}
                        onChange={(e) =>
                          commitRows(
                            rows.map((r) =>
                              r.id === row.id ? { ...r, value: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <button
                        className="icon-btn h-6 w-6 text-red hover:bg-red/10 hover:text-red"
                        onClick={() => commitRows(rows.filter((r) => r.id !== row.id))}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 border-t border-[var(--hairline)] px-4 py-2">
                  <button
                    className="btn-plain text-[13px]"
                    onClick={() =>
                      commitRows([...rows, { id: uid(), key: "", value: "" }])
                    }
                  >
                    <Icon name="plus" size={14} />
                    添加变量
                  </button>
                  <span className="text-[11px] text-label3">
                    在 URL / Headers / Body 中用 {"{{变量名}}"} 引用
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[13px] text-label2">
                创建或选择一个环境以编辑变量
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
              {selectedSecret ? (
                <div className="flex min-w-0 items-center gap-2">
                  <Icon name="lock" size={15} className="shrink-0 text-indigo" />
                  <input
                    className="field-ios h-8 w-52 font-mono text-[13px] font-semibold"
                    value={secretNameDraft}
                    onChange={(e) => setSecretNameDraft(e.target.value)}
                    onBlur={() => void commitSecretName()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    title="重命名（回车或失焦生效）"
                  />
                </div>
              ) : (
                <span className="text-[13px] text-label2">未选择机密变量</span>
              )}
              <button className="btn-primary h-8" onClick={onClose}>
                完成
              </button>
            </div>

            {selectedSecret ? (
              <div className="scroll-ios flex-1 space-y-4 overflow-y-auto px-4 py-4">
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-label2">
                    值（仅写入系统安全存储）
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      className="field-ios h-9 min-w-0 flex-1 font-mono text-[12px]"
                      placeholder={secretSaved ? "输入新值以覆盖…" : "输入 Token / 密码…"}
                      value={secretValue}
                      onChange={(e) => setSecretValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void handleSaveSecret()}
                    />
                    <button
                      className="btn-primary h-9 shrink-0"
                      onClick={() => void handleSaveSecret()}
                    >
                      <Icon name="lock" size={13} />
                      保存
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {secretSaved ? (
                      <span className="flex items-center gap-1 rounded-full bg-green/15 px-2 py-0.5 text-[11px] font-bold text-green">
                        <Icon name="checkmark" size={11} />
                        已存入系统安全存储
                      </span>
                    ) : (
                      <span className="rounded-full bg-fill2 px-2 py-0.5 text-[11px] font-bold text-label2">
                        尚未保存
                      </span>
                    )}
                    {secretMsg && (
                      <span className="text-[11px] font-medium text-green">
                        {secretMsg}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-label2">
                    在请求中引用
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-fill2 px-3 py-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-indigo">
                      {`{{vault.${selectedSecret.name}}}`}
                    </code>
                    <button
                      className="btn-plain shrink-0 text-[12px]"
                      onClick={() => void copySecretRef()}
                    >
                      <Icon name={copiedRef ? "checkmark" : "copy"} size={12} />
                      {copiedRef ? "已复制" : "复制"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-label3">
                    发送请求时由 Rust 从系统安全存储读取并注入，前端与历史记录中只保留占位符。
                  </p>
                </div>

                {secretError && (
                  <p className="rounded-lg bg-red/10 px-3 py-2 text-[12px] font-medium text-red">
                    {secretError}
                  </p>
                )}

                <div className="rounded-xl bg-fill2 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-label">
                    <Icon name="key" size={13} className="text-indigo" />
                    安全保证
                  </p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-label2">
                    <li>· 值保存在 Windows 凭据管理器 / macOS 钥匙串，绝不写入本地缓存文件。</li>
                    <li>· 导出 Collection 时自动脱敏为 {"{{vault.名称}}"} 占位符。</li>
                    <li>· 应用内任何位置都不显示明文，保存后输入框立即清空。</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-label2">
                <Icon name="lock" size={26} className="text-label3" />
                <p className="text-[13px]">创建或选择一个机密变量以编辑</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}