import type { OrderLineInput, Product } from "@whitelabel/shared";

interface Props {
  products: Product[];
  lines: OrderLineInput[];
  onChange: (lines: OrderLineInput[]) => void;
}

export function OrderLineEditor({ products, lines, onChange }: Props) {
  function updateLine(index: number, patch: Partial<OrderLineInput>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    const first = products[0];
    if (!first) return;
    onChange([...lines, { productId: first.id, quantity: 1, unitPrice: first.unitPrice }]);
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div className="order-line-editor">
      {lines.map((line, index) => (
        <div className="order-line-row" key={index}>
          <select
            value={line.productId}
            onChange={(e) => {
              const product = products.find((p) => p.id === e.target.value);
              updateLine(index, { productId: e.target.value, unitPrice: product?.unitPrice ?? line.unitPrice });
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={line.quantity}
            onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.unitPrice}
            onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
          />
          <button type="button" className="link-button" onClick={() => removeLine(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addLine} disabled={products.length === 0}>
        Add line
      </button>
    </div>
  );
}
