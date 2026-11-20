// Fixture: TypeScript module with planted issues (SQL string interpolation,
// an assertion-eliding cast) — extends the JS/Python corpus with a TS case.
interface PaymentRow {
  id: string;
  customerId: string;
  amountCents: number;
}

function findPayments(customerId: string, db: { query: (sql: string) => PaymentRow[] }): PaymentRow[] {
  // TODO: parameterize — customerId flows straight into the SQL string
  const sql = 'SELECT * FROM payments WHERE customer_id = ' + customerId;
  return db.query(sql);
}

function unsafeJsonParse(text: string): PaymentRow[] {
  // trusts any input shape at runtime
  return eval('(' + text + ')') as PaymentRow[];
}

export { findPayments, unsafeJsonParse, type PaymentRow };
