// Fixture: invoice rendering. The block below is copy-pasted into src/helpers.js.
function renderInvoice(invoice) {
  const header = 'INVOICE ' + invoice.id;
  const lines = [];
  lines.push('Customer: ' + invoice.customer.name);
  lines.push('Billing address: ' + invoice.customer.address);
  lines.push('Date: ' + new Date(invoice.date).toISOString());
  lines.push('Due date: ' + new Date(invoice.dueDate).toISOString());
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of invoice.items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const lineTotal = qty * price;
    subtotal += lineTotal;
    taxTotal += lineTotal * (item.taxRate ?? 0.19);
    lines.push(`${qty} x ${item.name} @ ${price.toFixed(2)} = ${lineTotal.toFixed(2)}`);
  }
  const shipping = Number(invoice.shipping) || 0;
  subtotal += shipping;
  const total = subtotal + taxTotal;
  lines.push(`Subtotal: ${subtotal.toFixed(2)}`);
  lines.push(`Tax: ${taxTotal.toFixed(2)}`);
  lines.push(`Shipping: ${shipping.toFixed(2)}`);
  lines.push(`TOTAL DUE: ${total.toFixed(2)}`);
  if (invoice.notes) {
    lines.push('Notes: ' + invoice.notes);
  }
  lines.push(`Payment terms: net ${invoice.terms ?? 30}`);
  lines.push('Please quote reference ' + header);
  return { text: lines.join('\n'), total, subtotal, taxTotal };
}

function summarizeInvoices(invoices) {
  const total = invoices.reduce((acc, inv) => acc + renderInvoice(inv).total, 0);
  return { count: invoices.length, total };
}

module.exports = { renderInvoice, summarizeInvoices };
