from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from typing import Optional

class CustomerCreate(BaseModel):
    legal_name: str = Field(min_length=2, max_length=200)
    display_name: Optional[str] = None
    gstin: Optional[str] = None
    state: str = Field(min_length=2, max_length=100)
    state_code: str = Field(pattern=r"^[0-9]{2}$")
    country: str = "India"
    email: Optional[str] = None
    phone: Optional[str] = None
    billing_address: Optional[str] = None

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v):
        if v in (None, ""):
            return None
        v = v.upper().strip()
        if len(v) != 15 or not v.isalnum():
            raise ValueError("GSTIN must be 15 alphanumeric characters")
        return v

class ProductCreate(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9]{2,5}$")
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=120)

class InvoiceCreate(BaseModel):
    customer_id: str
    product_id: str
    description: str = Field(min_length=2, max_length=1000)
    sac: Optional[str] = None
    qty: Decimal = Field(default=Decimal("1"), gt=0)
    taxable_value: Decimal = Field(gt=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    gst_rate: Decimal = Field(default=Decimal("18"), ge=0, le=100)
    due_date: Optional[str] = None
    notes: Optional[str] = None

class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    method: str = Field(min_length=2, max_length=80)
    external_reference: Optional[str] = Field(default=None, max_length=160)
    received_date: str

class ComplianceCreate(BaseModel):
    title: str
    authority: str
    status: str = "UNVERIFIED"
    due_date: Optional[str] = None
    owner: Optional[str] = None
    evidence_ref: Optional[str] = None
    risk: str = "MEDIUM"

class BoardMeetingCreate(BaseModel):
    meeting_no: str = Field(min_length=3, max_length=40)
    meeting_date: str
    title: str = Field(min_length=3, max_length=200)

class ResolutionCreate(BaseModel):
    resolution_no: str = Field(min_length=3, max_length=50)
    agenda_item: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=3, max_length=250)
    resolution_text: str = Field(min_length=20)
    authority_scope: Optional[str] = None
    approved_date: str

class AuthorityCreate(BaseModel):
    authority_no: str = Field(min_length=3, max_length=50)
    grantee: str = Field(min_length=2, max_length=200)
    purpose: str = Field(min_length=3, max_length=500)
    effective_date: str
    expiry_date: Optional[str] = None

class VendorCreate(BaseModel):
    legal_name: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=2, max_length=120)
    gstin: Optional[str] = None
    risk: str = "MEDIUM"
    product_codes: list[str] = []

class ContractCreate(BaseModel):
    contract_no: str = Field(min_length=3, max_length=80)
    contract_type: str = Field(min_length=2, max_length=120)
    counterparty_name: str = Field(min_length=2, max_length=200)
    product_codes: list[str] = []
    effective_date: str
    expiry_date: Optional[str] = None
    notice_days: Optional[int] = Field(default=None, ge=0, le=3650)
    value: Optional[Decimal] = Field(default=None, ge=0)
    document_ref: Optional[str] = None
    owner: Optional[str] = None

class EmployeeCreate(BaseModel):
    employee_no: str = Field(min_length=2, max_length=50)
    legal_name: str = Field(min_length=2, max_length=200)
    designation: str = Field(min_length=2, max_length=150)
    department: Optional[str] = None
    work_email: Optional[str] = None
    joining_date: str

class AssetCreate(BaseModel):
    asset_no: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=2, max_length=120)
    serial_no: Optional[str] = None
    assigned_employee_id: Optional[str] = None
    location: Optional[str] = None
    purchase_value: Optional[Decimal] = Field(default=None, ge=0)

class PlanCreate(BaseModel):
    product_id: str
    code: str = Field(pattern=r"^[A-Z0-9_-]{2,30}$")
    name: str = Field(min_length=2, max_length=120)
    billing_cycle: str = Field(pattern=r"^(MONTHLY|ANNUAL|ONE_TIME|USAGE)$")
    price: Decimal = Field(ge=0)
    gst_rate: Decimal = Field(default=Decimal("18"), ge=0, le=100)
    sac: Optional[str] = None
    effective_from: str
    effective_to: Optional[str] = None

class SubscriptionCreate(BaseModel):
    customer_id: str
    plan_id: str
    started_at: str
    current_period_start: str
    current_period_end: str
    external_reference: Optional[str] = None

class CreditNoteCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)
    taxable_value: Decimal = Field(gt=0)

class RefundCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)
    external_reference: Optional[str] = Field(default=None, max_length=160)
    refunded_date: str
    credit_note_id: Optional[str] = None

class BankAccountCreate(BaseModel):
    bank_name: str
    account_name: str
    masked_account: str
    ifsc: Optional[str] = None
    purpose: Optional[str] = None

class BankTransactionCreate(BaseModel):
    bank_account_id: str
    transaction_date: str
    amount: Decimal = Field(gt=0)
    direction: str = Field(pattern=r"^(CREDIT|DEBIT)$")
    reference: str = Field(min_length=2, max_length=200)
    description: Optional[str] = None
    source: str = "MANUAL_IMPORT"

class SettlementCreate(BaseModel):
    provider: str
    external_settlement_id: str
    gross: Decimal = Field(ge=0)
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    tax_on_fee: Decimal = Field(default=Decimal("0"), ge=0)
    net: Decimal = Field(ge=0)
    settlement_date: str

class ApprovalCreate(BaseModel):
    action_type: str
    entity_type: str
    entity_id: str
    required_role: str
    reason: Optional[str] = None

class ApprovalDecision(BaseModel):
    reason: Optional[str] = None

class NoticeCreate(BaseModel):
    authority: str
    reference_no: str
    title: str
    received_date: str
    response_due_date: Optional[str] = None
    risk: str = "HIGH"
    owner: Optional[str] = None
    source_document_id: Optional[str] = None
    notes: Optional[str] = None

class InspectionCreate(BaseModel):
    authority: str
    reference_no: Optional[str] = None
    scope_text: str
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    requested_by: Optional[str] = None
    owner: Optional[str] = None

class IntegrationCreate(BaseModel):
    provider: str
    integration_type: str
    environment: str = "production"
    status: str = "NOT_CONNECTED"
    owner: Optional[str] = None
    config: dict = {}
