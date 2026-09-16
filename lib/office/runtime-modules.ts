import type { FinanceSection, OfficeSection, WorkspaceKind } from "@/lib/office/workspaces";

export type RuntimeColumn = { key: string; label: string };
export type RuntimeModuleSpec = {
  path: string;
  columns?: readonly RuntimeColumn[];
  objectKeys?: readonly RuntimeColumn[];
  nestedRowsKey?: string;
  note: string;
};

const commandCenterKeys: readonly RuntimeColumn[] = [
  { key: "financial.issued_invoice_value", label: "Issued invoice value" },
  { key: "financial.collected", label: "Collected" },
  { key: "financial.receivables", label: "Receivables" },
];

const officeRuntimeModules: Partial<Record<OfficeSection, RuntimeModuleSpec>> = {
  dashboard: { path: "command-center", objectKeys: commandCenterKeys, note: "Derived from canonical KRAVIA Office records." },
  decisions: { path: "approvals", columns: [{ key: "action_type", label: "Action" }, { key: "entity_type", label: "Entity" }, { key: "requested_by", label: "Requested by" }, { key: "required_role", label: "Required role" }, { key: "status", label: "Status" }], note: "Maker-checker decision queue." },
  products: { path: "products", columns: [{ key: "code", label: "Code" }, { key: "name", label: "Product" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }], note: "Canonical product registry." },
  customers: { path: "customers", columns: [{ key: "legal_name", label: "Customer" }, { key: "gstin", label: "GSTIN" }, { key: "state", label: "State" }, { key: "country", label: "Country" }, { key: "status", label: "Status" }], note: "Canonical customer master." },
  governance: { path: "governance/meetings", columns: [{ key: "meeting_no", label: "Meeting" }, { key: "meeting_date", label: "Date" }, { key: "title", label: "Title" }, { key: "status", label: "Status" }], note: "Board and governance records." },
  compliance: { path: "compliance", columns: [{ key: "title", label: "Obligation" }, { key: "authority", label: "Authority" }, { key: "due_date", label: "Due" }, { key: "status", label: "Status" }], note: "Evidence-backed compliance records." },
  registrations: { path: "registrations", columns: [{ key: "registration_type", label: "Registration" }, { key: "authority", label: "Authority" }, { key: "expiry_date", label: "Expiry" }, { key: "status", label: "Status" }], note: "Company registration records." },
  documents: { path: "documents", columns: [{ key: "title", label: "Document" }, { key: "document_type", label: "Type" }, { key: "area", label: "Area" }, { key: "current_version", label: "Version" }, { key: "status", label: "Status" }], note: "Versioned and integrity-protected evidence." },
  contracts: { path: "contracts", columns: [{ key: "title", label: "Contract" }, { key: "counterparty", label: "Counterparty" }, { key: "effective_date", label: "Effective" }, { key: "expiry_date", label: "Expiry" }, { key: "status", label: "Status" }], note: "Controlled contract registry." },
  vendors: { path: "vendors", columns: [{ key: "legal_name", label: "Vendor" }, { key: "category", label: "Category" }, { key: "gstin", label: "GSTIN" }, { key: "status", label: "Status" }], note: "Controlled vendor registry." },
  people: { path: "people", columns: [{ key: "employee_code", label: "Code" }, { key: "name", label: "Name" }, { key: "designation", label: "Designation" }, { key: "status", label: "Status" }], note: "Role-restricted people records." },
  assets: { path: "assets", columns: [{ key: "asset_code", label: "Code" }, { key: "name", label: "Asset" }, { key: "category", label: "Category" }, { key: "renewal_date", label: "Renewal" }, { key: "status", label: "Status" }], note: "Corporate asset registry." },
  integrations: { path: "integrations", columns: [{ key: "provider", label: "Provider" }, { key: "integration_type", label: "Type" }, { key: "environment", label: "Environment" }, { key: "status", label: "Status" }], note: "Credential values are never exposed here." },
  audit: { path: "audit", columns: [{ key: "created_at", label: "Time" }, { key: "actor", label: "Actor" }, { key: "action", label: "Action" }, { key: "entity_type", label: "Entity" }], note: "Material actions from the canonical audit trail." },
};

const financeRuntimeModules: Partial<Record<FinanceSection, RuntimeModuleSpec>> = {
  dashboard: { path: "command-center", objectKeys: commandCenterKeys, note: "Canonical financial and exception summary." },
  billing: { path: "invoices", columns: [{ key: "invoice_no", label: "Invoice" }, { key: "issued_at", label: "Issued" }, { key: "total", label: "Total" }, { key: "balance", label: "Balance" }, { key: "status", label: "Status" }], note: "Immutable invoice snapshots." },
  gst: { path: "tax/gst/summary", objectKeys: [{ key: "taxable_value", label: "Taxable value" }, { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" }, { key: "igst", label: "IGST" }], note: "Working GST summary; filing status requires actual evidence." },
  accounting: { path: "accounting/trial-balance", objectKeys: [{ key: "total_debit", label: "Total debit" }, { key: "total_credit", label: "Total credit" }, { key: "balanced", label: "Balanced" }], nestedRowsKey: "accounts", columns: [{ key: "code", label: "Code" }, { key: "name", label: "Account" }, { key: "debit", label: "Debit" }, { key: "credit", label: "Credit" }, { key: "net", label: "Net" }], note: "Operational double-entry trial balance." },
  banking: { path: "banking/transactions", columns: [{ key: "transaction_date", label: "Date" }, { key: "direction", label: "Direction" }, { key: "amount", label: "Amount" }, { key: "reference", label: "Reference" }, { key: "match_status", label: "Match" }], note: "Imported/source bank transactions with reconciliation state." },
  payments: { path: "finance/payment-instructions", columns: [{ key: "id", label: "Instruction" }, { key: "direction", label: "Direction" }, { key: "amount", label: "Amount" }, { key: "provider", label: "Provider" }, { key: "status", label: "Status" }], note: "Maker-checker controlled payment instructions." },
  expenses: { path: "finance/expenses", columns: [{ key: "id", label: "Expense" }, { key: "title", label: "Title" }, { key: "amount", label: "Amount" }, { key: "due_date", label: "Due" }, { key: "status", label: "Status" }], note: "Expense funding never changes legal ownership." },
  reconciliation: { path: "banking/transactions", columns: [{ key: "transaction_date", label: "Date" }, { key: "amount", label: "Amount" }, { key: "reference", label: "Reference" }, { key: "source", label: "Source" }, { key: "match_status", label: "Match" }], note: "Deterministic matches and explicit exceptions." },
  ownership: { path: "ownership/summary", objectKeys: [{ key: "total_issued_shares", label: "Issued shares" }, { key: "source", label: "Source" }], nestedRowsKey: "cap_table", columns: [{ key: "shareholder.legal_name", label: "Shareholder" }, { key: "shares", label: "Shares" }, { key: "ownership_percent", label: "Ownership %" }], note: "Append-only ownership ledger; funding and expenses remain separate." },
  documents: { path: "documents", columns: [{ key: "title", label: "Document" }, { key: "document_type", label: "Type" }, { key: "area", label: "Area" }, { key: "current_version", label: "Version" }, { key: "status", label: "Status" }], note: "Finance evidence from the controlled vault." },
  compliance: { path: "compliance", columns: [{ key: "title", label: "Obligation" }, { key: "authority", label: "Authority" }, { key: "due_date", label: "Due" }, { key: "status", label: "Status" }], note: "Professional review and evidence-backed obligations." },
  audit: { path: "inspections", columns: [{ key: "authority", label: "Authority" }, { key: "reference_no", label: "Reference" }, { key: "scope_text", label: "Scope" }, { key: "status", label: "Status" }], note: "Scoped audit and inspection evidence." },
};

export function runtimeModuleSpec(workspace: WorkspaceKind, section: OfficeSection | FinanceSection): RuntimeModuleSpec | null {
  if (workspace === "finance") return financeRuntimeModules[section as FinanceSection] ?? null;
  return officeRuntimeModules[section as OfficeSection] ?? null;
}
