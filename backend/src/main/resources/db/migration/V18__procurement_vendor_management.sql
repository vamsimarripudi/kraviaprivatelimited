CREATE TABLE procurement_vendors (
    id uuid PRIMARY KEY,
    vendor_name varchar(255) NOT NULL,
    category varchar(40) NOT NULL,
    contact_person varchar(255),
    phone varchar(80),
    email varchar(255),
    gstin varchar(32),
    pan varchar(32),
    address text,
    service_type varchar(255),
    status varchar(40) NOT NULL,
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE purchase_requests (
    id uuid PRIMARY KEY,
    request_title varchar(255) NOT NULL,
    vendor_id uuid REFERENCES procurement_vendors(id),
    purpose text NOT NULL,
    estimated_amount numeric(19, 2) NOT NULL DEFAULT 0,
    priority varchar(40) NOT NULL,
    requested_by varchar(255) NOT NULL,
    required_date date,
    status varchar(40) NOT NULL,
    approval_status varchar(40) NOT NULL,
    notes text,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE purchase_orders (
    id uuid PRIMARY KEY,
    po_number varchar(120) NOT NULL UNIQUE,
    vendor_id uuid REFERENCES procurement_vendors(id),
    items_services text NOT NULL,
    amount numeric(19, 2) NOT NULL DEFAULT 0,
    taxes numeric(19, 2) NOT NULL DEFAULT 0,
    total_amount numeric(19, 2) NOT NULL DEFAULT 0,
    issue_date date NOT NULL,
    due_date date,
    status varchar(40) NOT NULL,
    linked_document_id uuid,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE vendor_bills (
    id uuid PRIMARY KEY,
    bill_number varchar(120) NOT NULL,
    vendor_id uuid REFERENCES procurement_vendors(id),
    bill_date date NOT NULL,
    due_date date NOT NULL,
    amount numeric(19, 2) NOT NULL DEFAULT 0,
    gst numeric(19, 2) NOT NULL DEFAULT 0,
    total_amount numeric(19, 2) NOT NULL DEFAULT 0,
    payment_status varchar(40) NOT NULL,
    purchase_order_id uuid REFERENCES purchase_orders(id),
    linked_document_id uuid,
    linked_finance_payable_id uuid REFERENCES vendor_payables(id),
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE procurement_subscriptions (
    id uuid PRIMARY KEY,
    service_name varchar(255) NOT NULL,
    vendor_id uuid REFERENCES procurement_vendors(id),
    plan varchar(255),
    billing_cycle varchar(80),
    amount numeric(19, 2) NOT NULL DEFAULT 0,
    renewal_date date,
    auto_renewal_status boolean NOT NULL DEFAULT false,
    owner varchar(255),
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE procurement_approvals (
    id uuid PRIMARY KEY,
    approval_title varchar(255) NOT NULL,
    approval_type varchar(80) NOT NULL,
    linked_record_type varchar(120),
    linked_record_id uuid,
    amount numeric(19, 2) NOT NULL DEFAULT 0,
    status varchar(40) NOT NULL,
    requested_by varchar(255) NOT NULL,
    approver varchar(255),
    approval_notes text,
    approval_date date,
    rejection_reason text,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE vendor_documents (
    id uuid PRIMARY KEY,
    vendor_id uuid REFERENCES procurement_vendors(id),
    document_id uuid REFERENCES documents(id),
    document_title varchar(255) NOT NULL,
    document_type varchar(120),
    status varchar(40) NOT NULL,
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE INDEX idx_procurement_vendors_category ON procurement_vendors (category);
CREATE INDEX idx_procurement_vendors_status ON procurement_vendors (status);
CREATE INDEX idx_purchase_requests_status ON purchase_requests (status);
CREATE INDEX idx_purchase_requests_approval_status ON purchase_requests (approval_status);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders (vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders (status);
CREATE INDEX idx_vendor_bills_vendor ON vendor_bills (vendor_id);
CREATE INDEX idx_vendor_bills_payment_status ON vendor_bills (payment_status);
CREATE INDEX idx_vendor_bills_due_date ON vendor_bills (due_date);
CREATE INDEX idx_procurement_subscriptions_renewal ON procurement_subscriptions (renewal_date);
CREATE INDEX idx_procurement_subscriptions_status ON procurement_subscriptions (status);
CREATE INDEX idx_procurement_approvals_status ON procurement_approvals (status);
CREATE INDEX idx_vendor_documents_vendor ON vendor_documents (vendor_id);
