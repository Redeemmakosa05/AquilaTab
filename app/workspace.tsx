"use client";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Split,
  Upload,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
  TriangleAlert,
} from "lucide-react";
import QRCode from "qrcode";
import { Brand, Mark } from "./brand";
import { api } from "@/lib/client";
import {
  calculate,
  decimal,
  money,
  parseMoney,
  receiptIssues,
  type BillData,
} from "@/lib/core";
import type { Snapshot } from "@/lib/db";
const palette = ["blue", "purple", "orange", "green"];
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "receipt", label: "Receipt scanner", icon: ScanLine },
  { id: "split", label: "Split workspace", icon: Split },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "activity", label: "Activity", icon: Activity },
];
function Amount({
  value,
  label,
  onChange,
  disabled,
}: {
  value: number | null;
  label: string;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : decimal(value));
  useEffect(() => setText(value === null ? "" : decimal(value)), [value]);
  return (
    <input
      className="amount-input"
      aria-label={label}
      disabled={disabled}
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        try {
          onChange(parseMoney(text));
        } catch {
          setText(value === null ? "" : decimal(value));
        }
      }}
    />
  );
}
export default function Workspace() {
  const [view, setView] = useState("overview"),
    [bills, setBills] = useState<Snapshot[]>([]),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<BillData | null>(null),
    [config, setConfig] = useState({
      ai: false,
      paypal: false,
      webhook: false,
    }),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [approved, setApproved] = useState(false),
    [prompt, setPrompt] = useState(
      "John has the burgers, Mary has the pizza, Alex has the pasta. Share the sides and drinks equally.",
    ),
    [name, setName] = useState(""),
    [qr, setQr] = useState(""),
    [showQr, setShowQr] = useState(false),
    [image, setImage] = useState("");
  const file = useRef<HTMLInputElement>(null),
    started = useRef(false);
  const current = bills.find((b) => b.id === selected) ?? bills[0],
    locked = current?.locked ?? false;
  let allocation: ReturnType<typeof calculate> = [],
    problem = "";
  if (draft) {
    try {
      allocation = calculate(draft);
    } catch (e) {
      problem = (e as Error).message;
    }
  }
  async function load(initial = false) {
    try {
      const data = await api("dashboard");
      setBills(data.bills);
      setConfig(data.config);
      if (initial) {
        setSelected(data.bills[0]?.id);
        setDraft(data.bills[0]?.data);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void load(true);
    }
    const timer = setInterval(() => void load(), 6000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (current && (!dirty || current.locked)) {
      setDraft(current.data);
      if (current.locked) setDirty(false);
    }
  }, [current?.id, current?.version]);
  useEffect(() => {
    if (current)
      QRCode.toDataURL(location.origin + "/table/" + current.id, {
        width: 300,
        margin: 2,
        color: { dark: "#172942", light: "#ffffff" },
      }).then(setQr);
  }, [current?.id]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!showQr) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector("[role=dialog]");
    const elements = Array.from(
      dialog?.querySelectorAll<HTMLElement>("button,a[href]") ?? [],
    );
    elements[0]?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") setShowQr(false);
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === elements[0]) {
          e.preventDefault();
          elements.at(-1)?.focus();
        }
        if (!e.shiftKey && document.activeElement === elements.at(-1)) {
          e.preventDefault();
          elements[0]?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [showQr]);
  function edit(data: BillData) {
    if (locked) return;
    setDraft(data);
    setDirty(true);
    setApproved(false);
  }
  function sync(data: Snapshot) {
    setBills((old) => old.map((b) => (b.id === data.id ? data : b)));
    setDraft(data.data);
    setDirty(false);
  }
  async function run(task: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(task);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function save() {
    const next = await api(`tables/${current.id}/save`, {
      version: current.version,
      data: draft,
    });
    sync(next);
    return next as Snapshot;
  }
  async function finalize() {
    await run("confirm", async () => {
      const saved = dirty ? await save() : current;
      sync(
        await api(`tables/${current.id}/finalize`, {
          version: saved.version,
          approved,
        }),
      );
      setView("payments");
      setNotice("Independent diner invitations are ready.");
    });
  }
  async function scan(receipt: File) {
    if (locked) return;
    await run("scan", async () => {
      const body = new FormData();
      body.append("file", receipt);
      const response = await fetch("/api/receipt", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (image) URL.revokeObjectURL(image);
      setImage(URL.createObjectURL(receipt));
      edit({ ...draft!, receipt: data.receipt, assignments: {} });
      setView("receipt");
      setNotice(
        "AI extraction is a proposal. Review every amount and flagged item.",
      );
    });
  }
  async function applyAI() {
    await run("ai", async () => {
      if (dirty) await save();
      const data = await api(`tables/${current.id}/ai`, {
        instruction: prompt,
      });
      edit({
        ...draft!,
        assignments: data.assignments,
        charges: data.charges,
        mode: "items",
      });
      setNotice("AI proposed an allocation. Review it before confirming.");
    });
  }
  function toggle(item: string, id: string) {
    if (!draft) return;
    const ids = draft.assignments[item] ?? [];
    edit({
      ...draft,
      mode: "items",
      assignments: {
        ...draft.assignments,
        [item]: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
      },
    });
  }
  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(location.origin + "/pay/" + token);
      setNotice("Invitation copied");
    } catch {
      setError("Clipboard unavailable. Open the link and copy its address.");
    }
  }
  const heading =
    view === "overview"
      ? "Good food. Fair shares."
      : view === "receipt"
        ? "Every detail, accounted for."
        : view === "split"
          ? "Less math. More together."
          : view === "payments"
            ? "A seamless finish."
            : view === "activity"
              ? "Every cent has a story."
              : "Built on trust.";
  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <div className="restaurant">
          <span>
            <UtensilsCrossed size={18} />
          </span>
          <div>
            <strong>The Olive Room</strong>
            <small>Restaurant workspace</small>
          </div>
          <ChevronDown size={13} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              aria-current={view === item.id ? "page" : undefined}
              className={"nav-item " + (view === item.id ? "active" : "")}
              onClick={() => setView(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-card">
            <ShieldCheck size={22} />
            <strong>A safe place to settle.</strong>
            <p>Explore the flow with no real money. Sandbox payments only.</p>
            <button onClick={() => setView("settings")}>
              View integrations <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="nav-item" onClick={() => setView("settings")}>
            <Settings2 size={18} />
            Settings & integrations
          </button>
          <div className="profile">
            <span className="avatar owner">OR</span>
            <div>
              <strong>Olive Room team</strong>
              <small>Merchant workspace</small>
            </div>
            <i className="online-dot" />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={13} />
            <strong>
              {nav.find((n) => n.id === view)?.label ?? "Integrations"}
            </strong>
          </div>
          <div>
            <span className="sandbox-badge">
              <i />
              Sandbox mode
            </span>
            <button
              className="icon-button"
              aria-label="Integration status"
              onClick={() => setView("settings")}
            >
              <ShieldCheck size={19} />
            </button>
            <span className="avatar owner">OR</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">SCAN. SPLIT. SETTLE.</div>
              <h1>{heading}</h1>
              <p>Bring everyone to the table. We’ll take care of the split.</p>
            </div>
            <button
              className="button primary"
              disabled={locked || !!busy}
              onClick={() => {
                setView("receipt");
                file.current?.click();
              }}
            >
              <ScanLine size={17} />
              <span>Scan a receipt</span>
              <Plus size={15} />
            </button>
          </div>
          {error && (
            <div role="alert" className="alert error">
              <TriangleAlert size={17} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="alert success">
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}
          <input
            className="hidden"
            ref={file}
            aria-label="Receipt image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            onChange={(e) => {
              if (e.target.files?.[0]) void scan(e.target.files[0]);
              e.target.value = "";
            }}
          />
          {!current || !draft ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Opening your workspace…
            </div>
          ) : (
            <>
              {["overview", "payments", "activity"].includes(view) && (
                <div className="stats">
                  <div className="stat dark">
                    <div>
                      <span>Total table bill</span>
                      <ReceiptText size={18} />
                    </div>
                    <strong>
                      {money(draft.receipt.total)}
                      <small>USD</small>
                    </strong>
                    <footer>
                      <span className="tiny-label">TABLE {current.number}</span>
                      <span>
                        {draft.diners.length} diners ·{" "}
                        {draft.receipt.items.length} items
                      </span>
                    </footer>
                    <svg viewBox="0 0 150 80" aria-hidden="true">
                      <path d="M-10 70C20 20 55 90 80 35S130 60 160 0" />
                    </svg>
                  </div>
                  <div className="stat">
                    <div>
                      <span>Verified payments</span>
                      <span className="stat-icon green">
                        <ArrowDownLeft size={18} />
                      </span>
                    </div>
                    <strong>{money(current.paid)}</strong>
                    <footer>
                      <span className="green-text">
                        <ShieldCheck size={12} />
                        Server verified
                      </span>
                      <span>
                        {current.shares.filter((s) => s.verified).length} of{" "}
                        {current.shares.length || draft.diners.length} paid
                      </span>
                    </footer>
                  </div>
                  <div className="stat">
                    <div>
                      <span>Still at the table</span>
                      <span className="stat-icon amber">
                        <Wallet size={18} />
                      </span>
                    </div>
                    <strong>{money(current.outstanding)}</strong>
                    <footer>
                      <span>
                        {current.closed
                          ? "Everyone is settled"
                          : "Awaiting diner payments"}
                      </span>
                      <span className="mini-progress">
                        <i
                          style={{
                            width:
                              (current.paid / draft.receipt.total) * 100 + "%",
                          }}
                        />
                      </span>
                    </footer>
                  </div>
                </div>
              )}
              <div className="table-toolbar">
                <div>
                  <span className="table-symbol">
                    <UtensilsCrossed size={18} />
                  </span>
                  <h2>Table {current.number}</h2>
                  <span className={"status " + (current.closed ? "paid" : "")}>
                    {current.closed
                      ? "Settled"
                      : locked
                        ? "Awaiting payments"
                        : "Open table"}
                  </span>
                  <span className="diner-count">
                    <Users size={14} />
                    {draft.diners.length} diners
                  </span>
                </div>
                <div>
                  {bills.length > 1 && (
                    <select
                      aria-label="Choose table"
                      value={current.id}
                      onChange={(e) => {
                        const next = bills.find(
                          (b) => b.id === e.target.value,
                        )!;
                        setSelected(next.id);
                        setDraft(next.data);
                        setDirty(false);
                        setApproved(false);
                      }}
                    >
                      {bills.map((b) => (
                        <option key={b.id} value={b.id}>
                          Table {b.number}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="button secondary compact"
                    onClick={() => setShowQr(true)}
                  >
                    <QrCode size={15} />
                    Table QR code
                  </button>
                </div>
              </div>
              {["overview", "receipt", "split"].includes(view) && (
                <div className="workspace-grid">
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <span className="kicker">THE BILL</span>
                        <h3>
                          {view === "receipt"
                            ? "Receipt details"
                            : "A table full of good things"}
                        </h3>
                      </div>
                      <button
                        className="text-button"
                        disabled={locked}
                        onClick={() => setView("receipt")}
                      >
                        Edit receipt <ArrowUpRight size={13} />
                      </button>
                    </div>
                    {view === "receipt" && (
                      <div
                        className="upload-box"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files[0])
                            void scan(e.dataTransfer.files[0]);
                        }}
                      >
                        <button
                          disabled={locked || !!busy}
                          onClick={() => file.current?.click()}
                        >
                          {busy === "scan" ? (
                            <LoaderCircle className="spin" />
                          ) : (
                            <Upload size={26} />
                          )}
                          <strong>
                            {busy === "scan"
                              ? "Reading the receipt…"
                              : "Drop a receipt. Leave the math."}
                          </strong>
                          <span>
                            JPG, PNG, WebP · up to 6 MB · Camera supported
                          </span>
                        </button>
                        <p>
                          <LockKeyhole size={11} />
                          {config.ai
                            ? "Images are sent to OpenAI for extraction."
                            : "Connect OpenAI to scan. Manual editing is available."}
                        </p>
                        {image && (
                          <img src={image} alt="Your receipt for review" />
                        )}
                      </div>
                    )}
                    <div className="receipt-meta">
                      <div>
                        <span>
                          <UtensilsCrossed size={15} />
                        </span>
                        <div>
                          {view === "receipt" ? (
                            <input
                              aria-label="Restaurant name"
                              value={draft.receipt.restaurant}
                              disabled={locked}
                              onChange={(e) =>
                                edit({
                                  ...draft,
                                  receipt: {
                                    ...draft.receipt,
                                    restaurant: e.target.value,
                                  },
                                })
                              }
                            />
                          ) : (
                            <strong>{draft.receipt.restaurant}</strong>
                          )}
                          <small>Fictional restaurant · Sample menu</small>
                        </div>
                      </div>
                      <small>#AQ–{current.id.slice(0, 5).toUpperCase()}</small>
                    </div>
                    <div className="item-header">
                      <span>ITEM</span>
                      <span>
                        {view === "receipt" ? "AMOUNT" : "ASSIGNED TO"}
                      </span>
                      {view !== "receipt" && <span>AMOUNT</span>}
                    </div>
                    <div className="items">
                      {draft.receipt.items.map((item, index) => (
                        <div
                          className={
                            "item-row " + (item.uncertain ? "uncertain" : "")
                          }
                          key={item.id}
                        >
                          <span className="quantity">{item.qty}×</span>
                          <div className="item-name">
                            {view === "receipt" ? (
                              <>
                                <input
                                  aria-label={"Item " + (index + 1) + " name"}
                                  value={item.name}
                                  disabled={locked}
                                  onChange={(e) =>
                                    edit({
                                      ...draft,
                                      receipt: {
                                        ...draft.receipt,
                                        items: draft.receipt.items.map((i) =>
                                          i.id === item.id
                                            ? { ...i, name: e.target.value }
                                            : i,
                                        ),
                                      },
                                    })
                                  }
                                />
                                <div className="item-edit">
                                  <label>
                                    Qty
                                    <input
                                      aria-label={item.name + " quantity"}
                                      type="number"
                                      min={1}
                                      max={99}
                                      value={item.qty}
                                      disabled={locked}
                                      onChange={(e) =>
                                        edit({
                                          ...draft,
                                          receipt: {
                                            ...draft.receipt,
                                            items: draft.receipt.items.map(
                                              (i) =>
                                                i.id === item.id
                                                  ? {
                                                      ...i,
                                                      qty: Math.max(
                                                        1,
                                                        Math.min(
                                                          99,
                                                          Number(
                                                            e.target.value,
                                                          ),
                                                        ),
                                                      ),
                                                    }
                                                  : i,
                                            ),
                                          },
                                        })
                                      }
                                    />
                                  </label>
                                  <label>
                                    Unit
                                    <Amount
                                      value={item.unit}
                                      disabled={locked}
                                      label={item.name + " unit price"}
                                      onChange={(n) =>
                                        edit({
                                          ...draft,
                                          receipt: {
                                            ...draft.receipt,
                                            items: draft.receipt.items.map(
                                              (i) =>
                                                i.id === item.id
                                                  ? { ...i, unit: n }
                                                  : i,
                                            ),
                                          },
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                                {item.uncertain && (
                                  <button
                                    className="confirm-item"
                                    onClick={() =>
                                      edit({
                                        ...draft,
                                        receipt: {
                                          ...draft.receipt,
                                          items: draft.receipt.items.map((i) =>
                                            i.id === item.id
                                              ? { ...i, uncertain: false }
                                              : i,
                                          ),
                                        },
                                      })
                                    }
                                  >
                                    Confirm this item <Check size={12} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <strong>{item.name}</strong>
                                <small>
                                  {draft.mode === "equal" ||
                                  (draft.assignments[item.id] ?? []).length > 1
                                    ? "Shared at the table"
                                    : (draft.assignments[item.id] ?? []).length
                                      ? "Individual item"
                                      : "Choose a diner"}
                                </small>
                              </>
                            )}
                          </div>
                          {view !== "receipt" && (
                            <div className="item-avatars">
                              {draft.diners.map((d, i) => (
                                <button
                                  key={d.id}
                                  title={d.name}
                                  aria-label={
                                    item.name + " assigned to " + d.name
                                  }
                                  aria-pressed={
                                    draft.mode === "equal" ||
                                    (draft.assignments[item.id] ?? []).includes(
                                      d.id,
                                    )
                                  }
                                  disabled={locked}
                                  className={
                                    "avatar tiny " +
                                    palette[i % 4] +
                                    (draft.mode === "equal" ||
                                    (draft.assignments[item.id] ?? []).includes(
                                      d.id,
                                    )
                                      ? ""
                                      : " unselected")
                                  }
                                  onClick={() => toggle(item.id, d.id)}
                                >
                                  {d.name[0]}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="item-price">
                            {view === "receipt" ? (
                              <Amount
                                value={item.amount}
                                label={item.name + " line amount"}
                                disabled={locked}
                                onChange={(n) =>
                                  edit({
                                    ...draft,
                                    receipt: {
                                      ...draft.receipt,
                                      items: draft.receipt.items.map((i) =>
                                        i.id === item.id
                                          ? { ...i, amount: n }
                                          : i,
                                      ),
                                    },
                                  })
                                }
                              />
                            ) : item.amount === null ? (
                              "—"
                            ) : (
                              money(item.amount)
                            )}
                            {view === "receipt" && !locked && (
                              <button
                                className="delete-item"
                                aria-label={"Remove " + item.name}
                                onClick={() =>
                                  edit({
                                    ...draft,
                                    receipt: {
                                      ...draft.receipt,
                                      items: draft.receipt.items.filter(
                                        (i) => i.id !== item.id,
                                      ),
                                    },
                                    assignments: Object.fromEntries(
                                      Object.entries(draft.assignments).filter(
                                        ([id]) => id !== item.id,
                                      ),
                                    ),
                                  })
                                }
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {view === "receipt" && !locked && (
                      <button
                        className="text-button add-item"
                        onClick={() =>
                          edit({
                            ...draft,
                            receipt: {
                              ...draft.receipt,
                              items: [
                                ...draft.receipt.items,
                                {
                                  id: "i_" + crypto.randomUUID().slice(0, 8),
                                  name: "New item",
                                  qty: 1,
                                  unit: 0,
                                  amount: 0,
                                  uncertain: false,
                                },
                              ],
                            },
                          })
                        }
                      >
                        <Plus size={13} />
                        Add an item
                      </button>
                    )}
                    <div className="receipt-totals">
                      <div>
                        <span>Subtotal</span>
                        <strong>
                          {money(
                            draft.receipt.items.reduce(
                              (sum, i) => sum + (i.amount ?? 0),
                              0,
                            ),
                          )}
                        </strong>
                      </div>
                      {(["tax", "service", "tip", "discount"] as const)
                        .filter(
                          (key) => view === "receipt" || draft.receipt[key] > 0,
                        )
                        .map((key) => (
                          <div key={key}>
                            <span>
                              {key === "service"
                                ? "Service charge"
                                : key[0].toUpperCase() + key.slice(1)}
                              {key === "discount" ? " (−)" : ""}
                            </span>
                            {view === "receipt" ? (
                              <Amount
                                value={draft.receipt[key]}
                                label={key}
                                disabled={locked}
                                onChange={(n) =>
                                  edit({
                                    ...draft,
                                    receipt: { ...draft.receipt, [key]: n },
                                  })
                                }
                              />
                            ) : (
                              <strong>{money(draft.receipt[key])}</strong>
                            )}
                          </div>
                        ))}
                      <div className="total">
                        <span>Total bill</span>
                        {view === "receipt" ? (
                          <Amount
                            value={draft.receipt.total}
                            label="Receipt grand total"
                            disabled={locked}
                            onChange={(n) =>
                              edit({
                                ...draft,
                                receipt: { ...draft.receipt, total: n },
                              })
                            }
                          />
                        ) : (
                          <strong>
                            {money(draft.receipt.total)}
                            <small> USD</small>
                          </strong>
                        )}
                      </div>
                    </div>
                    <div className="receipt-footer">
                      <ShieldCheck size={13} />
                      {receiptIssues(draft.receipt).length
                        ? "Review needed"
                        : "Every cent accounted for"}
                      <span>·</span>
                      {locked
                        ? "Amounts locked"
                        : "Integer-accurate calculations"}
                    </div>
                  </section>
                  <div className="right-column">
                    <section className="panel split-panel">
                      <div className="panel-header">
                        <div>
                          <span className="kicker">THE SPLIT</span>
                          <h3>A fair share, your way.</h3>
                        </div>
                        <span className="ai-tag">
                          <Sparkles size={12} />
                          AI assisted
                        </span>
                      </div>
                      <div className="split-tabs">
                        {(["items", "equal"] as const).map((mode) => (
                          <button
                            key={mode}
                            disabled={locked}
                            className={draft.mode === mode ? "selected" : ""}
                            onClick={() => edit({ ...draft, mode })}
                          >
                            {mode === "items" ? (
                              <Split size={14} />
                            ) : (
                              <Users size={14} />
                            )}{" "}
                            {mode === "items" ? "By item" : "Split equally"}
                          </button>
                        ))}
                      </div>
                      <div className="ai-prompt">
                        <label htmlFor="instructions">
                          <Sparkles size={14} />
                          Tell us who had what
                        </label>
                        <textarea
                          id="instructions"
                          value={prompt}
                          maxLength={2000}
                          disabled={locked}
                          onChange={(e) => setPrompt(e.target.value)}
                        />
                        <div>
                          <span>
                            {config.ai
                              ? "Powered by OpenAI"
                              : "Connect AI for natural language"}
                          </span>
                          <button
                            onClick={() => void applyAI()}
                            disabled={locked || !!busy || !prompt.trim()}
                          >
                            {busy === "ai" ? (
                              <LoaderCircle className="spin" size={13} />
                            ) : (
                              <Sparkles size={13} />
                            )}
                            Apply split <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="diners-heading">
                        <strong>Who’s at the table?</strong>
                        <span>{draft.diners.length} diners</span>
                      </div>
                      <div className="diners">
                        {draft.diners.map((d, i) => {
                          const share = allocation.find((a) => a.id === d.id);
                          return (
                            <div className="diner-row" key={d.id}>
                              <span className={"avatar " + palette[i % 4]}>
                                {d.name[0]}
                              </span>
                              <div>
                                <strong>{d.name}</strong>
                                <small>
                                  {share
                                    ? share.items.length +
                                      " assigned items · charges included"
                                    : "Awaiting allocation"}
                                </small>
                              </div>
                              <strong>
                                {share ? money(share.total) : "—"}
                              </strong>
                              {view === "split" &&
                                !locked &&
                                draft.diners.length > 1 && (
                                  <button
                                    className="icon-button"
                                    aria-label={"Remove " + d.name}
                                    onClick={() =>
                                      edit({
                                        ...draft,
                                        diners: draft.diners.filter(
                                          (x) => x.id !== d.id,
                                        ),
                                        assignments: Object.fromEntries(
                                          Object.entries(draft.assignments).map(
                                            ([id, who]) => [
                                              id,
                                              who.filter((x) => x !== d.id),
                                            ],
                                          ),
                                        ),
                                      })
                                    }
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                            </div>
                          );
                        })}
                      </div>
                      {view === "split" && !locked && (
                        <form
                          className="add-diner"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (name.trim() && draft.diners.length < 12) {
                              edit({
                                ...draft,
                                diners: [
                                  ...draft.diners,
                                  {
                                    id: "d_" + crypto.randomUUID().slice(0, 8),
                                    name: name.trim(),
                                  },
                                ],
                              });
                              setName("");
                            }
                          }}
                        >
                          <input
                            aria-label="New diner name"
                            placeholder="Add a diner"
                            maxLength={40}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                          <button
                            aria-label="Add diner"
                            disabled={draft.diners.length >= 12}
                          >
                            <Plus size={16} />
                          </button>
                        </form>
                      )}
                      <div className="charge-setting">
                        <span>Tax, service & tip</span>
                        <select
                          aria-label="Charge distribution"
                          disabled={locked || draft.mode === "equal"}
                          value={
                            draft.mode === "equal" ? "equal" : draft.charges
                          }
                          onChange={(e) =>
                            edit({
                              ...draft,
                              charges: e.target.value as
                                "equal" | "proportional",
                            })
                          }
                        >
                          <option value="equal">Split equally</option>
                          <option value="proportional">By item subtotal</option>
                        </select>
                      </div>
                      {problem && (
                        <div className="validation">
                          <TriangleAlert size={14} />
                          <span>{problem}</span>
                        </div>
                      )}
                      <div className="split-summary">
                        <div>
                          <span>Total allocated</span>
                          <strong>
                            {allocation.length
                              ? money(
                                  allocation.reduce(
                                    (sum, s) => sum + s.total,
                                    0,
                                  ),
                                )
                              : "—"}
                          </strong>
                        </div>
                        <span
                          className={
                            "validation-badge " + (problem ? "warn" : "")
                          }
                        >
                          <Check size={12} />
                          {problem ? "Review needed" : "Matches the bill"}
                        </span>
                      </div>
                      {locked ? (
                        <button
                          className="button primary full"
                          onClick={() => setView("payments")}
                        >
                          View diner invitations <ArrowRight size={15} />
                        </button>
                      ) : (
                        <>
                          <label className="approval">
                            <input
                              type="checkbox"
                              checked={approved}
                              onChange={(e) => setApproved(e.target.checked)}
                            />
                            <span>
                              The diners have reviewed this allocation. Lock
                              these amounts and create their payment
                              invitations.
                            </span>
                          </label>
                          <button
                            className="button primary full"
                            disabled={!!problem || !approved || !!busy}
                            onClick={() => void finalize()}
                          >
                            {busy === "confirm" ? (
                              <LoaderCircle className="spin" size={15} />
                            ) : (
                              <Link2 size={15} />
                            )}
                            Confirm split & create links{" "}
                            <ArrowRight size={15} />
                          </button>
                          {dirty && (
                            <button
                              className="text-button save-draft"
                              disabled={!!busy}
                              onClick={() =>
                                void run("save", async () => {
                                  await save();
                                  setNotice("Draft saved");
                                })
                              }
                            >
                              Save draft for later
                            </button>
                          )}
                        </>
                      )}
                    </section>
                    <div className="paypal-note">
                      <span className="paypal-logo">
                        Pay<span>Pal</span>
                      </span>
                      <div>
                        <strong>
                          Each diner pays the restaurant directly.
                        </strong>
                        <p>
                          Independent Sandbox orders. Verified captures. No
                          pooled funds.
                        </p>
                      </div>
                      <ShieldCheck size={20} />
                    </div>
                  </div>
                </div>
              )}
              {view === "payments" && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <span className="kicker">LIVE SETTLEMENT</span>
                      <h3>One table. Independent payments.</h3>
                    </div>
                    <button
                      className="button secondary compact"
                      disabled={!config.paypal || !!busy}
                      onClick={() =>
                        void run("reconcile", async () => {
                          sync(await api(`tables/${current.id}/reconcile`, {}));
                          setNotice("Checked against PayPal Sandbox");
                        })
                      }
                    >
                      <RefreshCw size={13} />
                      Reconcile
                    </button>
                  </div>
                  {!locked ? (
                    <div className="empty">
                      <Link2 size={34} />
                      <h3>Ready when the table is.</h3>
                      <p>
                        Confirm the reviewed split to create secure diner
                        invitations.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => setView("split")}
                      >
                        Review split <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="payment-table">
                        {current.shares.map((share, i) => (
                          <div className="payment-row" key={share.id}>
                            <div>
                              <span className={"avatar " + palette[i % 4]}>
                                {share.name[0]}
                              </span>
                              <div>
                                <strong>{share.name}</strong>
                                <small>
                                  {share.captureId
                                    ? "Capture: " + share.captureId
                                    : "Private, expiring invitation"}
                                </small>
                              </div>
                            </div>
                            <strong>{money(share.amount)}</strong>
                            <span
                              className={
                                "status " + (share.verified ? "paid" : "")
                              }
                            >
                              {share.verified
                                ? "Paid · verified"
                                : share.state
                                    .toLowerCase()
                                    .replaceAll("_", " ")}
                            </span>
                            <div>
                              <button
                                className="icon-button"
                                aria-label={
                                  "Copy " + share.name + " payment link"
                                }
                                onClick={() => void copy(share.token)}
                              >
                                <Copy size={15} />
                              </button>
                              <a
                                className="button secondary compact"
                                href={"/pay/" + share.token}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {share.verified ? "Receipt" : "Open link"}
                                <ArrowUpRight size={13} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="settlement">
                        <div>
                          <strong>
                            {current.closed
                              ? "Everyone’s settled."
                              : "Good things take a little time."}
                          </strong>
                          <p>
                            The table closes only when every exact capture is
                            verified.
                          </p>
                        </div>
                        <div>
                          <small>REMAINING</small>
                          <strong>{money(current.outstanding)}</strong>
                        </div>
                      </div>
                    </>
                  )}
                  {!config.paypal && (
                    <div className="integration-notice">
                      <TriangleAlert size={16} />
                      <span>
                        Sandbox credentials are required. No payment has been
                        simulated.
                      </span>
                      <button
                        className="text-button"
                        onClick={() => setView("settings")}
                      >
                        Configure <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </section>
              )}
              {view === "activity" && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <span className="kicker">AUDIT TRAIL</span>
                      <h3>From scan to settled.</h3>
                    </div>
                    <span className="tag">Refreshes every 6s</span>
                  </div>
                  <div className="events">
                    {current.events.map((e) => (
                      <div className="event" key={e.id}>
                        <span>
                          <ShieldCheck size={18} />
                        </span>
                        <div>
                          <strong>{e.message}</strong>
                          <small>
                            {e.type.replaceAll("_", " ").toLowerCase()}
                          </small>
                        </div>
                        <time>
                          {new Date(e.created).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {view === "settings" && (
                <div className="settings-grid">
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <span className="kicker">CONNECTIONS</span>
                        <h3>The foundations of a fair split.</h3>
                      </div>
                      <ShieldCheck size={22} />
                    </div>
                    {[
                      {
                        name: "OpenAI",
                        ready: config.ai,
                        description:
                          "Multimodal receipt reading and structured allocation proposals.",
                        keys: "OPENAI_API_KEY · OPENAI_MODEL",
                      },
                      {
                        name: "PayPal Sandbox · SDK v6",
                        ready: config.paypal,
                        description:
                          "Independently approved Orders v2 and verified merchant captures.",
                        keys: "PAYPAL_CLIENT_ID · PAYPAL_CLIENT_SECRET · PAYPAL_MERCHANT_ID",
                      },
                      {
                        name: "Verified PayPal webhooks",
                        ready: config.webhook,
                        description:
                          "Signature-authenticated payment events and replay protection.",
                        keys: "PAYPAL_WEBHOOK_ID",
                      },
                    ].map((item) => (
                      <div className="integration" key={item.name}>
                        <div>
                          <h4>{item.name}</h4>
                          <p>{item.description}</p>
                          <code>{item.keys}</code>
                        </div>
                        <span
                          className={"status " + (item.ready ? "paid" : "")}
                        >
                          {item.ready ? "Configured" : "Setup required"}
                        </span>
                      </div>
                    ))}
                    <div className="settings-footer">
                      <LockKeyhole size={14} />
                      Configure credentials on the server. Never paste secrets
                      into this page.
                    </div>
                  </section>
                  <section className="panel settings-info">
                    <span className="kicker">YOUR WORKSPACE</span>
                    <h3>Private by possession.</h3>
                    <p>
                      Your restaurant uses a secure, HTTP-only merchant session.
                      Diner invitations grant access only to the assigned share.
                    </p>
                    <p>
                      Keep this browser profile to retain merchant access for 30
                      days. Clearing cookies creates a separate workspace. Team
                      accounts and account recovery are outside this prototype.
                    </p>
                    <h4>Sandbox, always.</h4>
                    <p>
                      The Olive Room is fictional. Only USD and an eligible
                      Sandbox test merchant are supported. Zimbabwean production
                      merchant acceptance is not claimed.
                    </p>
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void run("new", async () => {
                          const next = await api("tables", {}),
                            data = await api("dashboard");
                          setBills(data.bills);
                          const created = data.bills.find(
                            (b: Snapshot) => b.id === next.id,
                          );
                          setSelected(created.id);
                          setDraft(created.data);
                          setDirty(false);
                          setApproved(false);
                          setView("overview");
                        })
                      }
                    >
                      <Plus size={15} />
                      Open a new sample table
                    </button>
                  </section>
                </div>
              )}
              {view === "overview" && (
                <div className="bottom-strip">
                  <span>
                    <i className="online-dot" />
                    At a glance
                  </span>
                  <p>
                    {locked
                      ? "Your invitations are ready. Share a link to keep things moving."
                      : "The table is open. Review the split, then invite everyone to settle."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setView(locked ? "payments" : "split")}
                  >
                    {locked ? "Track payments" : "Go to split workspace"}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Mark />A fair share. A seamless finish.
            </span>
            <span>
              <LockKeyhole size={11} />
              Sandbox prototype · No real payments
            </span>
          </footer>
        </div>
      </main>
      {showQr && (
        <div className="modal-backdrop" onClick={() => setShowQr(false)}>
          <section
            className="qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close QR"
              onClick={() => setShowQr(false)}
            >
              <X size={20} />
            </button>
            <span className="kicker">THE OLIVE ROOM</span>
            <h2 id="qr-title">You’re at the right table.</h2>
            <p>
              Scan to view Table {current?.number}’s live bill.
              <br />
              Individual payment invitations are shared separately.
            </p>
            {qr && (
              <img
                src={qr}
                alt={"QR code for Table " + current?.number}
                width={240}
                height={240}
              />
            )}
            <a
              className="button primary"
              href={"/table/" + current?.id}
              target="_blank"
              rel="noreferrer"
            >
              Open table page <ExternalLink size={14} />
            </a>
            <small>This QR never contains private payment tokens.</small>
          </section>
        </div>
      )}
    </div>
  );
}
