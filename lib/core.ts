import { z } from "zod";
export class Fault extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const minor = z.number().int().min(0).max(10_000_000);
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);
export const receiptSchema = z.object({
  restaurant: z.string().trim().min(1).max(100),
  currency: z.literal("USD"),
  items: z
    .array(
      z.object({
        id: identifier,
        name: z.string().trim().min(1).max(100),
        qty: z.number().int().min(1).max(99),
        unit: minor.nullable(),
        amount: minor.nullable(),
        uncertain: z.boolean(),
      }),
    )
    .min(1)
    .max(100),
  tax: minor,
  service: minor,
  tip: minor,
  discount: minor,
  total: minor,
});
export const billSchema = z.object({
  receipt: receiptSchema,
  diners: z
    .array(z.object({ id: identifier, name: z.string().trim().min(1).max(40) }))
    .min(1)
    .max(12),
  assignments: z.record(z.string(), z.array(identifier).max(12)),
  mode: z.enum(["items", "equal"]),
  charges: z.enum(["equal", "proportional"]),
});
export type BillData = z.infer<typeof billSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export function money(n: number) {
  return "$" + decimal(n);
}
export function decimal(n: number) {
  return `${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
}
export function parseMoney(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Fault(
      422,
      "Enter a positive amount with at most two decimal places",
    );
  const [whole, part = ""] = value.split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}
export function distribute(
  amount: number,
  weights: number[],
  priority: number[] = weights.map(() => 0),
) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !weights.length ||
    weights.some((n) => !Number.isSafeInteger(n) || n < 0)
  )
    throw new Fault(422, "Invalid monetary distribution");
  const big = weights.map(BigInt),
    sum = big.reduce((a, b) => a + b, 0n);
  if (sum === 0n) {
    if (amount)
      throw new Fault(422, "Cannot distribute charges over a zero subtotal");
    return weights.map(() => 0);
  }
  const out = big.map((n) => Number((BigInt(amount) * n) / sum));
  const order = big
    .map((n, i) => ({ i, remainder: (BigInt(amount) * n) % sum }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? priority[a.i] - priority[b.i] || a.i - b.i
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  const remaining = amount - out.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) out[order[i].i]++;
  return out;
}
export function receiptIssues(receipt: Receipt) {
  const errors: string[] = [],
    ids = new Set<string>(),
    names = new Set<string>();
  let subtotal = 0;
  for (const item of receipt.items) {
    if (ids.has(item.id)) errors.push("Duplicate item ID: " + item.id);
    ids.add(item.id);
    const name = item.name.trim().toLowerCase();
    if (names.has(name)) errors.push("Possible duplicate item: " + item.name);
    names.add(name);
    if (item.amount === null || item.unit === null)
      errors.push("Missing price: " + item.name);
    else {
      subtotal += item.amount;
      if (item.qty * item.unit !== item.amount)
        errors.push(
          "Unit price × quantity differs from line amount: " + item.name,
        );
    }
    if (item.uncertain) errors.push("Confirm uncertain item: " + item.name);
    if (/service|gratuity/i.test(item.name) && receipt.service)
      errors.push("Possible duplicate service charge: " + item.name);
  }
  if (
    subtotal +
      receipt.tax +
      receipt.service +
      receipt.tip -
      receipt.discount !==
    receipt.total
  )
    errors.push("Items and charges do not match the printed grand total");
  return [...new Set(errors)];
}
export function calculate(input: BillData) {
  const data = billSchema.parse(input),
    errors = receiptIssues(data.receipt);
  if (errors.length) throw new Fault(422, errors.join("; "));
  const ids = data.diners.map((d) => d.id);
  if (new Set(ids).size !== ids.length)
    throw new Fault(422, "Diner IDs must be unique");
  if (
    Object.keys(data.assignments).some(
      (id) => !data.receipt.items.some((item) => item.id === id),
    )
  )
    throw new Fault(422, "Unknown assigned item");
  const balances = ids.map(() => 0),
    lines: Record<string, number[]> = Object.create(null);
  for (const item of data.receipt.items) {
    const assigned =
      data.mode === "equal" ? ids : (data.assignments[item.id] ?? []);
    if (!assigned.length) throw new Fault(422, "Unassigned item: " + item.name);
    if (
      new Set(assigned).size !== assigned.length ||
      assigned.some((id) => !ids.includes(id))
    )
      throw new Fault(422, "Invalid diner assignment");
    lines[item.id] = distribute(
      item.amount!,
      ids.map((id) => (assigned.includes(id) ? 1 : 0)),
      data.mode === "equal" ? balances : undefined,
    );
    balances.forEach((_, i) => (balances[i] += lines[item.id][i]));
  }
  const weights =
    data.charges === "equal" || data.mode === "equal"
      ? ids.map(() => 1)
      : balances;
  const discount = distribute(
    data.receipt.discount,
    balances,
    balances.map((n) => -n),
  );
  const running = balances.map((n, i) => n - discount[i]);
  const allocate = (amount: number) => {
    const values = distribute(
      amount,
      weights,
      data.mode === "equal" ? running : undefined,
    );
    running.forEach((_, i) => (running[i] += values[i]));
    return values;
  };
  const tax = allocate(data.receipt.tax),
    service = allocate(data.receipt.service),
    tip = allocate(data.receipt.tip);
  const shares = ids.map((id, i) => ({
    id,
    name: data.diners[i].name,
    subtotal: balances[i],
    tax: tax[i],
    service: service[i],
    tip: tip[i],
    discount: discount[i],
    total: running[i],
    items: data.receipt.items
      .filter((item) => lines[item.id][i] > 0)
      .map((item) => ({ name: item.name, amount: lines[item.id][i] })),
  }));
  if (shares.some((s) => s.total <= 0))
    throw new Fault(422, "Every diner must owe at least one cent");
  if (shares.reduce((sum, s) => sum + s.total, 0) !== data.receipt.total)
    throw new Fault(422, "Allocation does not reconcile");
  return shares;
}
export const sample: BillData = {
  receipt: {
    restaurant: "The Olive Room",
    currency: "USD",
    items: [
      {
        id: "burgers",
        name: "Wagyu smash burger",
        qty: 2,
        unit: 1800,
        amount: 3600,
        uncertain: false,
      },
      {
        id: "pizza",
        name: "Margherita pizza",
        qty: 1,
        unit: 2400,
        amount: 2400,
        uncertain: false,
      },
      {
        id: "burrata",
        name: "Burrata & heirloom tomatoes",
        qty: 1,
        unit: 1600,
        amount: 1600,
        uncertain: false,
      },
      {
        id: "fries",
        name: "Truffle parmesan fries",
        qty: 1,
        unit: 900,
        amount: 900,
        uncertain: false,
      },
      {
        id: "drinks",
        name: "House lemonade",
        qty: 3,
        unit: 600,
        amount: 1800,
        uncertain: false,
      },
      {
        id: "pasta",
        name: "Wild mushroom rigatoni",
        qty: 1,
        unit: 2200,
        amount: 2200,
        uncertain: false,
      },
    ],
    tax: 1250,
    service: 625,
    tip: 0,
    discount: 0,
    total: 14375,
  },
  diners: [
    { id: "john", name: "John" },
    { id: "mary", name: "Mary" },
    { id: "alex", name: "Alex" },
  ],
  assignments: {
    burgers: ["john"],
    pizza: ["mary"],
    burrata: ["john", "mary", "alex"],
    fries: ["john", "mary", "alex"],
    drinks: ["john", "mary", "alex"],
    pasta: ["alex"],
  },
  mode: "items",
  charges: "equal",
};
