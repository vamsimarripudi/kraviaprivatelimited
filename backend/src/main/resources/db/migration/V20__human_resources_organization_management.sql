CREATE TABLE departments (
    id uuid PRIMARY KEY,
    department_name varchar(255) NOT NULL UNIQUE,
    description text,
    parent_department_id uuid REFERENCES departments(id),
    organization_level varchar(60),
    head_employee_id uuid,
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE designations (
    id uuid PRIMARY KEY,
    title varchar(255) NOT NULL,
    department_id uuid REFERENCES departments(id),
    organization_level varchar(60) NOT NULL,
    description text,
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE employees (
    id uuid PRIMARY KEY,
    employee_id varchar(120) NOT NULL UNIQUE,
    full_name varchar(255) NOT NULL,
    preferred_name varchar(255),
    profile_photo_document_id uuid REFERENCES documents(id),
    email varchar(255) NOT NULL,
    phone varchar(80),
    emergency_contact varchar(255),
    department_id uuid REFERENCES departments(id),
    designation_id uuid REFERENCES designations(id),
    reporting_manager_id uuid REFERENCES employees(id),
    employment_type varchar(40) NOT NULL,
    date_of_joining date,
    probation_status varchar(40),
    work_location varchar(255),
    employment_status varchar(40) NOT NULL,
    skills text,
    certifications text,
    related_document_id uuid REFERENCES documents(id),
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE employee_contacts (
    id uuid PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES employees(id),
    contact_type varchar(80) NOT NULL,
    contact_name varchar(255) NOT NULL,
    relationship varchar(120),
    phone varchar(80),
    email varchar(255),
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE attendance_records (
    id uuid PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES employees(id),
    attendance_date date NOT NULL,
    status varchar(40) NOT NULL,
    work_location varchar(255),
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE leave_requests (
    id uuid PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES employees(id),
    leave_type varchar(60) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(10,2) NOT NULL,
    status varchar(40) NOT NULL,
    manager_id uuid REFERENCES employees(id),
    approval_notes text,
    related_task_id uuid REFERENCES company_tasks(id),
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE holidays (
    id uuid PRIMARY KEY,
    holiday_name varchar(255) NOT NULL,
    holiday_date date NOT NULL,
    description text,
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE payroll_summaries (
    id uuid PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES employees(id),
    payroll_month varchar(20) NOT NULL,
    salary_structure varchar(255),
    basic_salary numeric(19,2) NOT NULL,
    allowances numeric(19,2) NOT NULL,
    deductions numeric(19,2) NOT NULL,
    pf numeric(19,2) NOT NULL,
    esi numeric(19,2) NOT NULL,
    professional_tax numeric(19,2) NOT NULL,
    tds numeric(19,2) NOT NULL,
    net_salary numeric(19,2) NOT NULL,
    status varchar(40) NOT NULL,
    linked_financial_record_id uuid REFERENCES financial_records(id),
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE performance_reviews (
    id uuid PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES employees(id),
    review_cycle varchar(120) NOT NULL,
    goals text,
    achievements text,
    manager_feedback text,
    employee_feedback text,
    rating varchar(60) NOT NULL,
    improvement_plan text,
    review_date date,
    reviewer_id uuid REFERENCES employees(id),
    related_task_id uuid REFERENCES company_tasks(id),
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE trainings (
    id uuid PRIMARY KEY,
    training_name varchar(255) NOT NULL,
    provider varchar(255),
    completion_date date,
    expiry_date date,
    certificate_document_id uuid REFERENCES documents(id),
    skills_covered text,
    status varchar(40) NOT NULL,
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE employee_certifications (
    id uuid PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES employees(id),
    training_id uuid REFERENCES trainings(id),
    certification_name varchar(255) NOT NULL,
    provider varchar(255),
    issue_date date,
    expiry_date date,
    certificate_document_id uuid REFERENCES documents(id),
    skills_covered text,
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE exit_records (
    id uuid PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES employees(id),
    resignation_date date,
    last_working_day date,
    reason text,
    exit_checklist text,
    asset_return_status varchar(120),
    final_settlement_status varchar(120),
    knowledge_transfer_status varchar(120),
    exit_interview_notes text,
    related_document_id uuid REFERENCES documents(id),
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE INDEX idx_departments_status ON departments(status);
CREATE INDEX idx_designations_department_id ON designations(department_id);
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_designation_id ON employees(designation_id);
CREATE INDEX idx_employees_reporting_manager_id ON employees(reporting_manager_id);
CREATE INDEX idx_employees_employment_status ON employees(employment_status);
CREATE INDEX idx_employee_contacts_employee_id ON employee_contacts(employee_id);
CREATE INDEX idx_attendance_employee_date ON attendance_records(employee_id, attendance_date);
CREATE INDEX idx_leave_employee_status ON leave_requests(employee_id, status);
CREATE INDEX idx_holidays_date ON holidays(holiday_date);
CREATE INDEX idx_payroll_employee_month ON payroll_summaries(employee_id, payroll_month);
CREATE INDEX idx_performance_employee_cycle ON performance_reviews(employee_id, review_cycle);
CREATE INDEX idx_trainings_status ON trainings(status);
CREATE INDEX idx_certifications_employee_id ON employee_certifications(employee_id);
CREATE INDEX idx_exit_records_employee_id ON exit_records(employee_id);