(function () {
  "use strict";

  const EMPTY_TEXT = "No information has been added yet.";
  const EMPTY_DOCUMENTS_TEXT = "No documents have been added yet.";
  const EMPTY_MEETINGS_TEXT = "No board meeting records have been added yet.";
  const EMPTY_FINANCIALS_TEXT = "No financial records have been added yet.";
  const EMPTY_COMPLIANCE_TEXT = "No compliance items have been added yet.";
  const EMPTY_TASKS_TEXT = "No company tasks have been added yet.";
  const EMPTY_PRODUCTS_TEXT = "No product records have been added yet.";
  const EMPTY_CONTACTS_TEXT = "No contacts have been added yet.";
  const EMPTY_ACTIVITY_TEXT = "No activity has been recorded yet.";
  const EMPTY_ECOSYSTEM_TEXT = "No ecosystem product records have been added yet.";
  const STORAGE_KEYS = { theme: "kravia.portal.theme" };
  const COMPLIANCE_CLOSED_STATUSES = new Set(["Approved", "Rejected", "Completed", "Not Applicable"]);
  const TASK_CLOSED_STATUSES = new Set(["Done", "Archived"]);
  const PRODUCT_CLOSED_STATUSES = new Set(["Paused"]);
  const CONTACT_CLOSED_STATUSES = new Set(["Closed", "Archived"]);
  const DUE_SOON_DAYS = 14;
  const AUDIT_SEVERITIES = ["Info", "Important", "Warning", "Critical"];
  const DISPLAY_MODES = ["light", "dark", "system"];
  const ECOSYSTEM_PRODUCT_STATUSES = ["IDEA", "DEVELOPMENT", "TESTING", "STAGING", "LAUNCH_READY", "LIVE", "PAUSED", "ARCHIVED"];
  const ECOSYSTEM_LAUNCH_STATUSES = ["NOT_STARTED", "PLANNED", "IN_PROGRESS", "BLOCKED", "LAUNCH_READY", "LAUNCHED", "NOT_APPLICABLE"];
  const ECOSYSTEM_REVENUE_STATUSES = ["NOT_STARTED", "NOT_VISIBLE", "TRACKING_READY", "REVENUE_ACTIVE", "PAUSED", "NOT_APPLICABLE"];
  const ECOSYSTEM_COMPLIANCE_STATUSES = ["NOT_REVIEWED", "REVIEW_REQUIRED", "IN_REVIEW", "COMPLIANT", "BLOCKED", "NOT_APPLICABLE"];
  const ECOSYSTEM_SECURITY_STATUSES = ["NOT_REVIEWED", "REVIEW_REQUIRED", "IN_REVIEW", "SECURE", "RISK_IDENTIFIED", "NOT_APPLICABLE"];
  const ECOSYSTEM_DEPLOYMENT_STATUSES = ["NOT_DEPLOYED", "LOCAL", "STAGING", "PRODUCTION", "FAILED", "PAUSED"];

  const icons = {
    search: '<svg viewBox="0 0 24 24" focusable="false"><path d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/></svg>',
    print: '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7v-6Z"/></svg>',
    moon: '<svg viewBox="0 0 24 24" focusable="false"><path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 4V2m0 20v-2m5.66-13.66 1.41-1.41M4.93 19.07l1.41-1.41M20 12h2M2 12h2m13.66 5.66 1.41 1.41M4.93 4.93l1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    edit: '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
    file: '<svg viewBox="0 0 24 24" focusable="false"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6"/></svg>',
    upload: '<svg viewBox="0 0 24 24" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>',
    view: '<svg viewBox="0 0 24 24" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>',
    download: '<svg viewBox="0 0 24 24" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    save: '<svg viewBox="0 0 24 24" focusable="false"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>',
    close: '<svg viewBox="0 0 24 24" focusable="false"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    archive: '<svg viewBox="0 0 24 24" focusable="false"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>',
    calculator: '<svg viewBox="0 0 24 24" focusable="false"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>',
  };

  const root = document.getElementById("app-root");

  const state = {
    user: null,
    permissions: {},
    company: null,
    profile: null,
    documents: [],
    categories: [],
    meetingTypes: [],
    meetingStatuses: [],
    meetings: [],
    financialRecords: [],
    complianceCategories: [],
    complianceStatuses: [],
    compliancePriorities: [],
    complianceItems: [],
    taskCategories: [],
    taskStatuses: [],
    taskPriorities: [],
    tasks: [],
    productCategories: [],
    productStatuses: [],
    productStages: [],
    products: [],
    contactCategories: [],
    contactStatuses: [],
    contacts: [],
    ecosystemProducts: [],
    ecosystemStatusOptions: [],
    ecosystemLaunchStatusOptions: [],
    ecosystemRevenueStatusOptions: [],
    ecosystemComplianceStatusOptions: [],
    ecosystemSecurityStatusOptions: [],
    ecosystemDeploymentStatusOptions: [],
    ecosystemPersistence: "Local JSON fallback",
    auditLogs: [],
    auditSeverities: [],
    settings: null,
    settingsUsers: [],
    profileDraft: null,
    profileErrors: {},
    isEditingProfile: false,
    isSavingProfile: false,
    isUploadOpen: false,
    uploadMessage: "",
    uploadErrors: {},
    docSearch: "",
    docCategory: "all",
    meetingSearch: "",
    meetingTypeFilter: "all",
    meetingStatusFilter: "all",
    meetingMode: "idle",
    meetingDraft: null,
    meetingErrors: {},
    openMeetingId: "",
    financeSearch: "",
    financeMonthFilter: "all",
    financeMode: "idle",
    financeDraft: null,
    financeErrors: {},
    openFinancialId: "",
    complianceSearch: "",
    complianceCategoryFilter: "all",
    complianceStatusFilter: "all",
    compliancePriorityFilter: "all",
    complianceSort: "due-asc",
    complianceMode: "idle",
    complianceDraft: null,
    complianceErrors: {},
    openComplianceId: "",
    taskSearch: "",
    taskCategoryFilter: "all",
    taskAssigneeFilter: "all",
    taskStatusFilter: "all",
    taskPriorityFilter: "all",
    taskSort: "due-asc",
    taskMode: "idle",
    taskDraft: null,
    taskErrors: {},
    openTaskId: "",
    productSearch: "",
    productStatusFilter: "all",
    productStageFilter: "all",
    productMode: "idle",
    productDraft: null,
    productErrors: {},
    openProductId: "",
    contactSearch: "",
    contactCategoryFilter: "all",
    contactStatusFilter: "all",
    contactMode: "idle",
    contactDraft: null,
    contactErrors: {},
    openContactId: "",
    ecosystemSearch: "",
    ecosystemStatusFilter: "all",
    ecosystemOwnerFilter: "all",
    ecosystemMode: "idle",
    ecosystemDraft: null,
    ecosystemErrors: {},
    openEcosystemId: "",
    auditSearch: "",
    auditModuleFilter: "all",
    auditUserFilter: "all",
    auditSeverityFilter: "all",
    auditDateFrom: "",
    auditDateTo: "",
    openAuditId: "",
    settingsDraft: null,
    settingsErrors: {},
    isEditingSettings: false,
    isSavingSettings: false,
    flash: "",
  };

  init();

  async function init() {
    applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || "light");
    try {
      const data = await requestJSON("/api/bootstrap");
      hydrateState(data);
      render();
    } catch (error) {
      if (error.status === 401) {
        window.location.assign("/login");
        return;
      }
      renderFatal(error.message || "The workspace could not be loaded.");
    }
  }

  function hydrateState(data) {
    state.user = data.user;
    state.permissions = data.permissions || {};
    state.company = data.company;
    state.profile = data.profile;
    state.documents = data.documents || [];
    state.categories = data.documentCategories || [];
    state.meetingTypes = data.boardMeetingTypes || [];
    state.meetingStatuses = data.boardMeetingStatuses || [];
    state.meetings = data.boardMeetings || [];
    state.financialRecords = data.financialRecords || [];
    state.complianceCategories = data.complianceCategories || [];
    state.complianceStatuses = data.complianceStatuses || [];
    state.compliancePriorities = data.compliancePriorities || [];
    state.complianceItems = data.complianceItems || [];
    state.taskCategories = data.taskCategories || [];
    state.taskStatuses = data.taskStatuses || [];
    state.taskPriorities = data.taskPriorities || [];
    state.tasks = data.tasks || [];
    state.productCategories = data.productCategories || [];
    state.productStatuses = data.productStatuses || [];
    state.productStages = data.productStages || [];
    state.products = data.products || [];
    state.contactCategories = data.contactCategories || [];
    state.contactStatuses = data.contactStatuses || [];
    state.contacts = data.contacts || [];
    state.ecosystemProducts = data.ecosystemProducts || [];
    state.ecosystemStatusOptions = data.ecosystemStatusOptions || ECOSYSTEM_PRODUCT_STATUSES;
    state.ecosystemLaunchStatusOptions = data.ecosystemLaunchStatusOptions || ECOSYSTEM_LAUNCH_STATUSES;
    state.ecosystemRevenueStatusOptions = data.ecosystemRevenueStatusOptions || ECOSYSTEM_REVENUE_STATUSES;
    state.ecosystemComplianceStatusOptions = data.ecosystemComplianceStatusOptions || ECOSYSTEM_COMPLIANCE_STATUSES;
    state.ecosystemSecurityStatusOptions = data.ecosystemSecurityStatusOptions || ECOSYSTEM_SECURITY_STATUSES;
    state.ecosystemDeploymentStatusOptions = data.ecosystemDeploymentStatusOptions || ECOSYSTEM_DEPLOYMENT_STATUSES;
    state.ecosystemPersistence = data.ecosystemPersistence || "Local JSON fallback";
    state.auditLogs = data.auditLogs || [];
    state.auditSeverities = data.auditSeverities || AUDIT_SEVERITIES;
    state.settings = data.settings || null;
    state.settingsUsers = data.settingsUsers || [];
  }

  function render() {
    document.title = `${state.company.name} | Internal Workspace`;
    root.className = "page-shell workspace-shell";
    root.innerHTML = `
      <header class="portal-header workspace-header" aria-labelledby="company-name">
        <div class="header-copy">
          <p class="overline">Secure Internal Workspace</p>
          <h1 id="company-name">${escapeHTML(state.company.name)}</h1>
          <p class="header-subtitle">${escapeHTML(state.company.subtitle)}</p>
        </div>
        <dl class="header-metadata" aria-label="Company status metadata">
          <div><dt>Current Date</dt><dd>${escapeHTML(formatCurrentDate())}</dd></div>
          <div><dt>Last Updated</dt><dd class="${isEmpty(state.profile.lastUpdatedDate) ? "is-empty" : ""}">${escapeHTML(formatDateValue(state.profile.lastUpdatedDate))}</dd></div>
          <div><dt>Company Status</dt><dd class="${isEmpty(state.profile.companyStatus) ? "is-empty" : ""}">${escapeHTML(valueText(state.profile.companyStatus))}</dd></div>
          <div><dt>Signed In</dt><dd>${escapeHTML(state.user.name)} <span class="role-badge">${escapeHTML(formatRole(state.user.role))}</span></dd></div>
        </dl>
      </header>

      <section class="control-bar" aria-label="Workspace controls">
        <nav class="workspace-tabs" aria-label="Workspace sections">
          ${workspaceTabs().map((tab) => `<a href="#${tab.id}">${escapeHTML(tab.label)}</a>`).join("")}
        </nav>
        <div class="action-group" aria-label="View controls">
          <button class="icon-button" type="button" id="print-button" aria-label="Print workspace" title="Print workspace">${icons.print}</button>
          <div class="theme-toggle" role="group" aria-label="Theme">
            <button type="button" data-theme-option="light" aria-pressed="${document.documentElement.dataset.theme !== "dark"}" title="Light mode">${icons.sun}<span class="visually-hidden">Light mode</span></button>
            <button type="button" data-theme-option="dark" aria-pressed="${document.documentElement.dataset.theme === "dark"}" title="Dark mode">${icons.moon}<span class="visually-hidden">Dark mode</span></button>
          </div>
          <button class="icon-button" type="button" id="logout-button" aria-label="Log out" title="Log out">${icons.logout}</button>
        </div>
      </section>

      <div class="content-layout phase-layout">
        <aside class="section-sidebar" aria-label="Workspace navigation">
          <nav class="section-nav"><ol class="nav-list">
            ${workspaceTabs().map((tab, index) => `<li><a class="nav-link ${index === 0 ? "is-active" : ""}" href="#${tab.id}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHTML(tab.label)}</strong></a></li>`).join("")}
          </ol></nav>
        </aside>
        <main id="main-content" class="main-content" tabindex="-1">
          ${state.flash ? `<div class="form-message is-success" role="status">${escapeHTML(state.flash)}</div>` : ""}
          ${renderOperationalSummary()}
          ${renderCompanyProfile()}
          ${renderDocumentVault()}
          ${renderBoardMeetings()}
          ${renderFinancialDashboard()}
          ${renderComplianceCenter()}
          ${renderTasksSection()}
          ${renderProductsPortfolio()}
          ${state.permissions.canViewEcosystem ? renderEcosystemControlPlane() : ""}
          ${renderContactsPartners()}
          ${state.permissions.canViewAuditLogs ? renderAuditActivityLog() : ""}
          ${state.permissions.canViewSettings ? renderSettingsSection() : ""}
        </main>
      </div>
    `;

    bindWorkspaceEvents();
    setSectionObserver();
  }

  function workspaceTabs() {
    const tabs = [
      { id: "company-profile", label: "Company Profile" },
      { id: "document-vault", label: "Document Vault" },
      { id: "board-meetings", label: "Board Meetings" },
      { id: "financial-dashboard", label: "Financial Dashboard" },
      { id: "compliance-center", label: "Compliance Center" },
      { id: "company-tasks", label: "Company Tasks" },
      { id: "products-portfolio", label: "Products Portfolio" },
      { id: "ecosystem-control-plane", label: "Ecosystem" },
      { id: "contacts-partners", label: "Contacts & Partners" },
    ];
    if (state.permissions.canViewAuditLogs) tabs.push({ id: "audit-activity-log", label: "Audit Log" });
    if (state.permissions.canViewSettings) tabs.push({ id: "workspace-settings", label: "Settings" });
    return tabs;
  }

  function renderOperationalSummary() {
    const summary = getOperationalSummary();
    return `
      <section class="operational-summary" aria-label="Operational summary">
        <div class="summary-grid operational-summary-grid">
          ${renderSummaryCard("Open compliance items", summary.openCompliance)}
          ${renderSummaryCard("Overdue compliance items", summary.overdueCompliance, summary.overdueCompliance > 0 ? "negative" : "")}
          ${renderSummaryCard("Upcoming compliance due dates", summary.upcomingCompliance, summary.upcomingCompliance > 0 ? "warning" : "")}
          ${renderSummaryCard("Open tasks", summary.openTasks)}
          ${renderSummaryCard("Overdue tasks", summary.overdueTasks, summary.overdueTasks > 0 ? "negative" : "")}
          ${renderSummaryCard("Blocked tasks", summary.blockedTasks, summary.blockedTasks > 0 ? "negative" : "")}
          ${renderSummaryCard("Active products", summary.activeProducts)}
          ${renderSummaryCard("Products launch-ready", summary.launchReadyProducts, summary.launchReadyProducts > 0 ? "positive" : "")}
          ${renderSummaryCard("Product risks", summary.productRisks, summary.productRisks > 0 ? "negative" : "")}
          ${renderSummaryCard("Registered ecosystem products", summary.ecosystemRegisteredProducts)}
          ${renderSummaryCard("Live ecosystem products", summary.ecosystemLiveProducts, summary.ecosystemLiveProducts > 0 ? "positive" : "")}
          ${renderSummaryCard("Ecosystem gaps", summary.ecosystemRemainingGaps, summary.ecosystemRemainingGaps > 0 ? "warning" : "")}
          ${renderSummaryCard("Important contacts", summary.importantContacts)}
          ${renderSummaryCard("Follow-ups due", summary.followUpsDue, summary.followUpsDue > 0 ? "warning" : "")}
          ${renderSummaryCard("Waiting partner responses", summary.waitingPartnerResponses, summary.waitingPartnerResponses > 0 ? "warning" : "")}
          ${renderSummaryCard("Recent activity", summary.recentActivity)}
          ${renderSummaryCard("Critical changes", summary.criticalChanges, summary.criticalChanges > 0 ? "negative" : "")}
          ${renderSummaryCard("Pending settings actions", summary.pendingSettingsActions, summary.pendingSettingsActions > 0 ? "warning" : "")}
          ${renderSummaryCard("Security status", summary.securityStatus)}
          ${renderSummaryCard("Last backup placeholder", summary.lastBackupPlaceholder)}
        </div>
      </section>`;
  }

  function renderSummaryCard(label, value, tone) {
    return `<article class="summary-card ${tone || ""}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(String(value))}</strong></article>`;
  }

  function renderCompanyProfile() {
    const profile = state.isEditingProfile ? state.profileDraft : state.profile;
    const canEdit = state.permissions.canEditProfile;
    return `
      <section class="portal-section" id="company-profile" data-section="company-profile">
        ${sectionHeader("01", "Company Profile", "Legal identity, capital, contact, ownership, and statutory status.", canEdit && !state.isEditingProfile ? `<button class="secondary-button" type="button" id="edit-profile">${icons.edit}<span>Edit profile</span></button>` : !canEdit ? `<span class="access-note">Read-only access</span>` : "")}
        ${state.isEditingProfile ? renderProfileForm(profile) : renderProfileDisplay(profile)}
      </section>`;
  }

  function renderProfileDisplay(profile) {
    return `<div class="panel detail-panel"><dl class="detail-list">
      ${getProfileFields(profile).map((field) => `<div class="detail-row"><dt>${escapeHTML(field.label)}</dt><dd>${renderDisplayValue(field.value)}</dd></div>`).join("")}
    </dl></div>`;
  }

  function renderProfileForm(profile) {
    const errors = state.profileErrors;
    return `
      <form class="panel enterprise-form" id="profile-form" novalidate>
        <div class="form-grid">
          ${textInput("companyName", "Company name", profile.companyName, errors.companyName, { required: true })}
          ${textInput("cin", "CIN", profile.cin, errors.cin)}
          ${textInput("pan", "PAN", profile.pan, errors.pan)}
          ${textInput("tan", "TAN", profile.tan, errors.tan)}
          ${textInput("email", "Email", profile.email, errors.email, { type: "email" })}
          ${textInput("phone", "Phone", profile.phone, errors.phone)}
          ${textInput("dateOfIncorporation", "Date of incorporation", profile.dateOfIncorporation, errors.dateOfIncorporation, { type: "date" })}
          ${textInput("authorizedCapital", "Authorized capital", profile.authorizedCapital, errors.authorizedCapital)}
          ${textInput("paidUpCapital", "Paid-up capital", profile.paidUpCapital, errors.paidUpCapital)}
          ${textInput("companyStatus", "Company status", profile.companyStatus, errors.companyStatus)}
          ${textInput("lastUpdatedDate", "Last updated date", profile.lastUpdatedDate, errors.lastUpdatedDate, { type: "date" })}
          ${textareaInput("registeredOfficeAddress", "Registered office address", profile.registeredOfficeAddress, errors.registeredOfficeAddress)}
          ${textareaInput("directors", "Directors", arrayToLines(profile.directors), errors.directors, "Enter one director per line.")}
          ${textareaInput("shareholders", "Shareholders", arrayToLines(profile.shareholders), errors.shareholders, "Enter one shareholder per line.")}
        </div>
        <div class="form-actions">
          <button class="primary-button" type="submit" ${state.isSavingProfile ? "disabled" : ""}>${icons.save}<span>${state.isSavingProfile ? "Saving" : "Save changes"}</span></button>
          <button class="secondary-button" type="button" id="cancel-profile" ${state.isSavingProfile ? "disabled" : ""}>${icons.close}<span>Cancel</span></button>
        </div>
      </form>`;
  }

  function renderDocumentVault() {
    const filteredDocuments = getFilteredDocuments();
    const canManage = state.permissions.canManageDocuments;
    return `
      <section class="portal-section" id="document-vault" data-section="document-vault">
        ${sectionHeader("02", "Document Vault", "Organized company records with secure placeholders for future storage integration.", canManage ? `<button class="secondary-button" type="button" id="open-upload">${icons.upload}<span>Upload document</span></button>` : `<span class="access-note">Documents are view-only for this role</span>`)}
        <div class="vault-controls">
          <label class="visually-hidden" for="document-search">Search documents</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="document-search" type="search" autocomplete="off" value="${escapeAttribute(state.docSearch)}" placeholder="Search documents"></div>
          <label class="visually-hidden" for="category-filter">Filter by category</label>
          <select id="category-filter" class="select-control">
            <option value="all"${state.docCategory === "all" ? " selected" : ""}>All categories</option>
            ${state.categories.map((category) => `<option value="${escapeAttribute(category.id)}"${state.docCategory === category.id ? " selected" : ""}>${escapeHTML(category.name)}</option>`).join("")}
          </select>
        </div>
        ${state.isUploadOpen ? renderUploadPlaceholder() : ""}
        <div class="document-grid category-grid" aria-label="Document categories">
          ${state.categories.map((category) => {
            const count = state.documents.filter((documentItem) => documentItem.categoryId === category.id).length;
            const active = state.docCategory === category.id;
            return `<button class="document-card category-card${active ? " is-active" : ""}" type="button" data-category-card="${escapeAttribute(category.id)}"><span class="document-icon" aria-hidden="true">${icons.file}</span><span class="category-card-title">${escapeHTML(category.name)}</span><span class="category-card-meta">${count} ${count === 1 ? "document" : "documents"}</span></button>`;
          }).join("")}
        </div>
        <div class="panel documents-panel">${filteredDocuments.length > 0 ? renderDocumentTable(filteredDocuments) : renderEmptyBlock("Document Vault", EMPTY_DOCUMENTS_TEXT)}</div>
      </section>`;
  }

  function renderUploadPlaceholder() {
    return `
      <form class="panel upload-panel" id="upload-form" novalidate>
        <div class="panel-heading"><div><h3>Upload placeholder</h3><p>Document storage is prepared for backend integration. No file is stored in this local build.</p></div><button class="icon-button" type="button" id="close-upload" aria-label="Close upload placeholder">${icons.close}</button></div>
        <div class="form-grid">
          ${textInput("documentTitle", "Document title", "", state.uploadErrors.documentTitle, { required: true })}
          ${selectInput("documentCategory", "Document category", "", state.categories.map((category) => ({ value: category.id, label: category.name })), state.uploadErrors.documentCategory, { required: true, placeholder: "Select a category" })}
          ${textInput("documentType", "Document type", "", state.uploadErrors.documentType)}
          ${textInput("documentVersion", "Version", "", state.uploadErrors.documentVersion)}
          <div class="form-field full-span"><label for="documentFile">File</label><input id="documentFile" name="documentFile" type="file" disabled><p class="field-help">File storage is intentionally disabled until a real backend vault is connected.</p></div>
        </div>
        <div class="form-actions"><button class="primary-button" type="submit">${icons.upload}<span>Prepare upload</span></button><button class="secondary-button" type="button" id="cancel-upload">Cancel</button></div>
        ${state.uploadMessage ? `<div class="form-message is-success" role="status">${escapeHTML(state.uploadMessage)}</div>` : ""}
      </form>`;
  }

  function renderDocumentTable(documents) {
    return `<div class="table-scroll"><table><thead><tr><th scope="col">Document title</th><th scope="col">Category</th><th scope="col">Type</th><th scope="col">Uploaded date</th><th scope="col">Uploaded by</th><th scope="col">Status</th><th scope="col">Version</th><th scope="col">Actions</th></tr></thead><tbody>
      ${documents.map((documentItem) => `<tr><td>${renderDisplayValue(documentItem.title)}</td><td>${escapeHTML(getCategoryName(documentItem.categoryId))}</td><td>${renderDisplayValue(documentItem.type)}</td><td>${renderDisplayValue(formatDateValue(documentItem.uploadedDate))}</td><td>${renderDisplayValue(documentItem.uploadedBy)}</td><td>${renderStatusValue(documentItem.status)}</td><td>${renderDisplayValue(documentItem.version)}</td><td><div class="table-actions"><button class="icon-button compact" type="button" data-doc-action="view" data-doc-id="${escapeAttribute(documentItem.id)}" aria-label="View document placeholder">${icons.view}</button><button class="icon-button compact" type="button" data-doc-action="download" data-doc-id="${escapeAttribute(documentItem.id)}" aria-label="Download document placeholder">${icons.download}</button></div></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  function renderBoardMeetings() {
    const canManage = state.permissions.canManageMeetings;
    const canArchive = state.permissions.canArchiveMeetings;
    const meetings = getFilteredMeetings();
    return `
      <section class="portal-section" id="board-meetings" data-section="board-meetings">
        ${sectionHeader("03", "Board Meetings", "Record discussions, decisions, resolutions, action owners, and next steps.", canManage ? `<button class="secondary-button" type="button" id="create-meeting">${icons.plus}<span>Create meeting</span></button>` : `<span class="access-note">Read-only access</span>`)}
        <div class="vault-controls tri-controls">
          <label class="visually-hidden" for="meeting-search">Search meetings</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="meeting-search" type="search" autocomplete="off" value="${escapeAttribute(state.meetingSearch)}" placeholder="Search meetings"></div>
          <select id="meeting-type-filter" class="select-control" aria-label="Filter by meeting type"><option value="all"${state.meetingTypeFilter === "all" ? " selected" : ""}>All meeting types</option>${state.meetingTypes.map((type) => `<option value="${escapeAttribute(type)}"${state.meetingTypeFilter === type ? " selected" : ""}>${escapeHTML(type)}</option>`).join("")}</select>
          <select id="meeting-status-filter" class="select-control" aria-label="Filter by meeting status"><option value="all"${state.meetingStatusFilter === "all" ? " selected" : ""}>All statuses</option>${state.meetingStatuses.map((status) => `<option value="${escapeAttribute(status)}"${state.meetingStatusFilter === status ? " selected" : ""}>${escapeHTML(status)}</option>`).join("")}</select>
        </div>
        ${state.meetingMode !== "idle" ? renderMeetingForm() : ""}
        <div class="panel records-panel">${meetings.length > 0 ? renderMeetingsList(meetings, canManage, canArchive) : renderEmptyBlock("Board Meetings", EMPTY_MEETINGS_TEXT)}</div>
      </section>`;
  }

  function renderMeetingForm() {
    const draft = state.meetingDraft;
    const errors = state.meetingErrors;
    const title = state.meetingMode === "edit" ? "Edit meeting record" : "Create meeting record";
    return `
      <form class="panel enterprise-form record-form" id="meeting-form" novalidate>
        <div class="panel-heading"><div><h3>${escapeHTML(title)}</h3><p>Use structured fields so the record can later export cleanly to PDF or a board pack.</p></div><button class="icon-button" type="button" id="cancel-meeting" aria-label="Cancel meeting form">${icons.close}</button></div>
        <div class="form-grid">
          ${textInput("meetingTitle", "Meeting title", draft.meetingTitle, errors.meetingTitle, { required: true })}
          ${textInput("meetingDate", "Meeting date", draft.meetingDate, errors.meetingDate, { type: "date", required: true })}
          ${selectInput("meetingType", "Meeting type", draft.meetingType, state.meetingTypes.map((type) => ({ value: type, label: type })), errors.meetingType, { required: true })}
          ${selectInput("status", "Status", draft.status, state.meetingStatuses.map((status) => ({ value: status, label: status })), errors.status, { required: true })}
          ${textareaInput("attendees", "Attendees", arrayToLines(draft.attendees), errors.attendees, "Enter one attendee per line.")}
          ${textareaInput("agenda", "Agenda", arrayToLines(draft.agenda), errors.agenda, "At least one agenda item is required.")}
          ${textareaInput("discussionNotes", "Discussion notes", draft.discussionNotes, errors.discussionNotes)}
          ${textareaInput("decisionsTaken", "Decisions taken", draft.decisionsTaken, errors.decisionsTaken)}
          ${textareaInput("boardResolutions", "Board resolutions", draft.boardResolutions, errors.boardResolutions)}
          ${textareaInput("actionItems", "Action items", arrayToLines(draft.actionItems), errors.actionItems, "Enter one action item per line.")}
          ${textInput("actionOwner", "Action owner", draft.actionOwner, errors.actionOwner)}
          ${textInput("dueDate", "Due date", draft.dueDate, errors.dueDate, { type: "date" })}
          ${textInput("nextMeetingDate", "Next meeting date", draft.nextMeetingDate, errors.nextMeetingDate, { type: "date" })}
          ${textInput("attachmentsPlaceholder", "Attachments placeholder", draft.attachmentsPlaceholder, errors.attachmentsPlaceholder)}
        </div>
        <div class="form-actions"><button class="primary-button" type="submit">${icons.save}<span>Save meeting</span></button><button class="secondary-button" type="button" id="cancel-meeting-secondary">Cancel</button></div>
      </form>`;
  }

  function renderMeetingsList(meetings, canManage, canArchive) {
    return `<div class="record-list">${meetings.map((meeting) => {
      const isOpen = state.openMeetingId === meeting.id;
      return `<article class="record-card printable-record">
        <div class="record-card-header">
          <div><p class="overline">${escapeHTML(meeting.meetingType)}</p><h3>${escapeHTML(meeting.meetingTitle)}</h3><p>${escapeHTML(formatDateValue(meeting.meetingDate))} · ${renderStatusValue(meeting.status)}</p></div>
          <div class="record-actions">
            <button class="secondary-button" type="button" data-meeting-view="${escapeAttribute(meeting.id)}">${icons.view}<span>${isOpen ? "Hide" : "View"}</span></button>
            ${canManage ? `<button class="secondary-button" type="button" data-meeting-edit="${escapeAttribute(meeting.id)}">${icons.edit}<span>Edit</span></button>` : ""}
            ${canArchive && meeting.status !== "Archived" ? `<button class="secondary-button" type="button" data-meeting-archive="${escapeAttribute(meeting.id)}">${icons.archive}<span>Archive</span></button>` : ""}
          </div>
        </div>
        ${isOpen ? renderRecordDetails([
          ["Attendees", meeting.attendees], ["Agenda", meeting.agenda], ["Discussion notes", meeting.discussionNotes], ["Decisions taken", meeting.decisionsTaken],
          ["Board resolutions", meeting.boardResolutions], ["Action items", meeting.actionItems], ["Action owner", meeting.actionOwner], ["Due date", formatDateValue(meeting.dueDate)],
          ["Next meeting date", formatDateValue(meeting.nextMeetingDate)], ["Attachments", meeting.attachmentsPlaceholder], ["Created by", meeting.createdBy], ["Last updated", formatDateTimeValue(meeting.lastUpdated)],
        ]) : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function renderFinancialDashboard() {
    const canEdit = state.permissions.canEditFinancials;
    const records = getFilteredFinancialRecords();
    const focusRecord = getFocusFinancialRecord(records);
    return `
      <section class="portal-section" id="financial-dashboard" data-section="financial-dashboard">
        ${sectionHeader("04", "Financial Dashboard", "Founder-level monthly financial summaries with calculated profit/loss and GST position.", canEdit ? `<button class="secondary-button" type="button" id="create-financial">${icons.plus}<span>Add month</span></button>` : `<span class="access-note">Read-only access</span>`)}
        <div class="vault-controls finance-controls">
          <label class="visually-hidden" for="finance-search">Search financial records</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="finance-search" type="search" autocomplete="off" value="${escapeAttribute(state.financeSearch)}" placeholder="Search financial records"></div>
          <select id="finance-month-filter" class="select-control" aria-label="Filter by reporting month"><option value="all"${state.financeMonthFilter === "all" ? " selected" : ""}>All reporting months</option>${getFinancialMonths().map((month) => `<option value="${escapeAttribute(month)}"${state.financeMonthFilter === month ? " selected" : ""}>${escapeHTML(formatMonth(month))}</option>`).join("")}</select>
        </div>
        ${state.financeMode !== "idle" ? renderFinancialForm() : ""}
        ${focusRecord ? renderFinancialSummary(focusRecord, canEdit) : `<div class="panel">${renderEmptyBlock("Financial Dashboard", EMPTY_FINANCIALS_TEXT)}</div>`}
        ${records.length > 0 ? renderFinancialHistory(records, canEdit) : ""}
      </section>`;
  }

  function renderFinancialForm() {
    const draft = state.financeDraft;
    const errors = state.financeErrors;
    const title = state.financeMode === "edit" ? "Edit monthly financial record" : "Add monthly financial record";
    return `
      <form class="panel enterprise-form record-form" id="financial-form" novalidate>
        <div class="panel-heading"><div><h3>${escapeHTML(title)}</h3><p>Numbers are stored as structured monthly summaries. Profit/loss and net GST are calculated automatically.</p></div><button class="icon-button" type="button" id="cancel-financial" aria-label="Cancel financial form">${icons.close}</button></div>
        <div class="form-grid">
          ${textInput("reportingMonth", "Reporting month", draft.reportingMonth, errors.reportingMonth, { type: "month", required: true })}
          ${textInput("revenue", "Revenue", draft.revenue, errors.revenue, { type: "number", step: "0.01", required: true })}
          ${textInput("expenses", "Expenses", draft.expenses, errors.expenses, { type: "number", step: "0.01", required: true })}
          ${textInput("cashBalance", "Cash balance", draft.cashBalance, errors.cashBalance, { type: "number", step: "0.01" })}
          ${textInput("receivables", "Receivables", draft.receivables, errors.receivables, { type: "number", step: "0.01" })}
          ${textInput("payables", "Payables", draft.payables, errors.payables, { type: "number", step: "0.01" })}
          ${textInput("gstCollected", "GST collected", draft.gstCollected, errors.gstCollected, { type: "number", step: "0.01", required: true })}
          ${textInput("gstPaid", "GST paid", draft.gstPaid, errors.gstPaid, { type: "number", step: "0.01", required: true })}
          ${textInput("cloudSoftwareSubscriptions", "Cloud/software subscriptions", draft.cloudSoftwareSubscriptions, errors.cloudSoftwareSubscriptions, { type: "number", step: "0.01" })}
          ${textInput("vendorPayments", "Vendor payments", draft.vendorPayments, errors.vendorPayments, { type: "number", step: "0.01" })}
          ${textInput("directorRemuneration", "Director remuneration", draft.directorRemuneration, errors.directorRemuneration, { type: "number", step: "0.01" })}
          ${textareaInput("founderNotes", "Founder notes", draft.founderNotes, errors.founderNotes)}
        </div>
        <div class="calculation-strip" aria-label="Calculated financial values"><span>Profit / Loss <strong class="${moneyTone(calculateDraftProfitLoss(draft))}-text">${escapeHTML(formatCurrency(calculateDraftProfitLoss(draft)))}</strong></span><span>Net GST position <strong class="${moneyTone(calculateDraftNetGst(draft))}-text">${escapeHTML(formatCurrency(calculateDraftNetGst(draft)))}</strong></span></div>
        <div class="form-actions"><button class="primary-button" type="submit">${icons.save}<span>Save month</span></button><button class="secondary-button" type="button" id="cancel-financial-secondary">Cancel</button></div>
      </form>`;
  }

  function renderFinancialSummary(record, canEdit) {
    return `
      <div class="summary-grid" aria-label="Monthly financial summary">
        ${renderSummaryCard("Reporting month", formatMonth(record.reportingMonth))}
        ${renderSummaryCard("Revenue", formatCurrency(record.revenue), "positive")}
        ${renderSummaryCard("Expenses", formatCurrency(record.expenses), Number(record.expenses) > 0 ? "negative" : "")}
        ${renderSummaryCard("Profit / Loss", formatCurrency(record.profitLoss), moneyTone(record.profitLoss))}
        ${renderSummaryCard("Cash balance", formatCurrency(record.cashBalance))}
        ${renderSummaryCard("Receivables", formatCurrency(record.receivables))}
        ${renderSummaryCard("Payables", formatCurrency(record.payables))}
        ${renderSummaryCard("Net GST position", formatCurrency(record.netGstPosition), moneyTone(record.netGstPosition))}
      </div>
      <article class="record-card printable-record">
        <div class="record-card-header"><div><p class="overline">Monthly Summary</p><h3>${escapeHTML(formatMonth(record.reportingMonth))}</h3><p>Last updated ${escapeHTML(formatDateTimeValue(record.lastUpdated))}</p></div>${canEdit ? `<div class="record-actions"><button class="secondary-button" type="button" data-finance-edit="${escapeAttribute(record.id)}">${icons.edit}<span>Edit</span></button></div>` : ""}</div>
        ${renderRecordDetails([
          ["GST collected", formatCurrency(record.gstCollected)], ["GST paid", formatCurrency(record.gstPaid)], ["Cloud/software subscriptions", formatCurrency(record.cloudSoftwareSubscriptions)], ["Vendor payments", formatCurrency(record.vendorPayments)],
          ["Director remuneration", formatCurrency(record.directorRemuneration)], ["Founder notes", record.founderNotes], ["Created by", record.createdBy], ["Last updated", formatDateTimeValue(record.lastUpdated)],
        ])}
      </article>`;
  }

  function renderFinancialHistory(records, canEdit) {
    return `<div class="panel finance-history-panel"><div class="panel-heading"><div><h3>Financial history</h3><p>Monthly records are stored in a structure that can later support PDF export or accounting integration.</p></div></div><div class="table-scroll"><table><thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Expenses</th><th scope="col">Profit / Loss</th><th scope="col">Net GST</th><th scope="col">Last updated</th><th scope="col">Actions</th></tr></thead><tbody>${records.map((record) => `<tr><td>${escapeHTML(formatMonth(record.reportingMonth))}</td><td>${escapeHTML(formatCurrency(record.revenue))}</td><td>${escapeHTML(formatCurrency(record.expenses))}</td><td>${renderMoneyBadge(record.profitLoss)}</td><td>${renderMoneyBadge(record.netGstPosition)}</td><td>${escapeHTML(formatDateTimeValue(record.lastUpdated))}</td><td><div class="table-actions"><button class="icon-button compact" type="button" data-finance-open="${escapeAttribute(record.id)}" aria-label="View monthly summary">${icons.view}</button>${canEdit ? `<button class="icon-button compact" type="button" data-finance-edit="${escapeAttribute(record.id)}" aria-label="Edit monthly summary">${icons.edit}</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div></div>`;
  }

  function renderComplianceCenter() {
    const canManage = state.permissions.canManageCompliance;
    const canArchive = state.permissions.canArchiveCompliance;
    const items = getFilteredComplianceItems();
    return `
      <section class="portal-section" id="compliance-center" data-section="compliance-center">
        ${sectionHeader("05", "Compliance Center", "Track statutory, tax, banking, legal, and governance obligations without inventing records.", canManage ? `<button class="secondary-button" type="button" id="create-compliance">${icons.plus}<span>Add compliance</span></button>` : `<span class="access-note">Read-only access</span>`)}
        <div class="vault-controls phase3-controls">
          <label class="visually-hidden" for="compliance-search">Search compliance</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="compliance-search" type="search" autocomplete="off" value="${escapeAttribute(state.complianceSearch)}" placeholder="Search compliance items"></div>
          <select id="compliance-category-filter" class="select-control" aria-label="Filter compliance by category"><option value="all"${state.complianceCategoryFilter === "all" ? " selected" : ""}>All categories</option>${state.complianceCategories.map((category) => `<option value="${escapeAttribute(category)}"${state.complianceCategoryFilter === category ? " selected" : ""}>${escapeHTML(category)}</option>`).join("")}</select>
          <select id="compliance-status-filter" class="select-control" aria-label="Filter compliance by status"><option value="all"${state.complianceStatusFilter === "all" ? " selected" : ""}>All statuses</option>${state.complianceStatuses.map((status) => `<option value="${escapeAttribute(status)}"${state.complianceStatusFilter === status ? " selected" : ""}>${escapeHTML(status)}</option>`).join("")}</select>
          <select id="compliance-priority-filter" class="select-control" aria-label="Filter compliance by priority"><option value="all"${state.compliancePriorityFilter === "all" ? " selected" : ""}>All priorities</option>${state.compliancePriorities.map((priority) => `<option value="${escapeAttribute(priority)}"${state.compliancePriorityFilter === priority ? " selected" : ""}>${escapeHTML(priority)}</option>`).join("")}</select>
          <select id="compliance-sort" class="select-control" aria-label="Sort compliance"><option value="due-asc"${state.complianceSort === "due-asc" ? " selected" : ""}>Due date ascending</option><option value="due-desc"${state.complianceSort === "due-desc" ? " selected" : ""}>Due date descending</option><option value="updated-desc"${state.complianceSort === "updated-desc" ? " selected" : ""}>Recently updated</option></select>
        </div>
        ${state.complianceMode !== "idle" ? renderComplianceForm() : ""}
        <div class="panel records-panel">${items.length > 0 ? renderComplianceList(items, canManage, canArchive) : renderEmptyBlock("Compliance Center", EMPTY_COMPLIANCE_TEXT)}</div>
      </section>`;
  }

  function renderComplianceForm() {
    const draft = state.complianceDraft;
    const errors = state.complianceErrors;
    const title = state.complianceMode === "edit" ? "Edit compliance item" : "Add compliance item";
    return `
      <form class="panel enterprise-form record-form" id="compliance-form" novalidate>
        <div class="panel-heading"><div><h3>${escapeHTML(title)}</h3><p>Keep each obligation structured by owner, due date, status, priority, and related document.</p></div><button class="icon-button" type="button" id="cancel-compliance" aria-label="Cancel compliance form">${icons.close}</button></div>
        <div class="form-grid">
          ${textInput("complianceTitle", "Compliance title", draft.complianceTitle, errors.complianceTitle, { required: true })}
          ${selectInput("category", "Category", draft.category, state.complianceCategories.map((category) => ({ value: category, label: category })), errors.category, { required: true, placeholder: "Select category" })}
          ${selectInput("status", "Status", draft.status, state.complianceStatuses.map((status) => ({ value: status, label: status })), errors.status, { required: true })}
          ${selectInput("priority", "Priority", draft.priority, state.compliancePriorities.map((priority) => ({ value: priority, label: priority })), errors.priority, { required: true })}
          ${textInput("dueDate", "Due date", draft.dueDate, errors.dueDate, { type: "date" })}
          ${textInput("responsiblePerson", "Responsible person", draft.responsiblePerson, errors.responsiblePerson)}
          ${textInput("relatedDocument", "Related document", draft.relatedDocument, errors.relatedDocument)}
          ${textareaInput("description", "Description", draft.description, errors.description)}
          ${textareaInput("notes", "Notes", draft.notes, errors.notes)}
        </div>
        <div class="form-actions"><button class="primary-button" type="submit">${icons.save}<span>Save compliance</span></button><button class="secondary-button" type="button" id="cancel-compliance-secondary">Cancel</button></div>
      </form>`;
  }

  function renderComplianceList(items, canManage, canArchive) {
    return `<div class="record-list">${items.map((item) => {
      const isOpen = state.openComplianceId === item.id;
      return `<article class="record-card printable-record">
        <div class="record-card-header">
          <div><p class="overline">${escapeHTML(item.category)}</p><h3>${escapeHTML(item.complianceTitle)}</h3><p>${renderStatusValue(item.status)} ${renderPriorityValue(item.priority)} ${item.archived ? renderStatusValue("Archived") : ""} ${renderDueIndicator(item, isOpenComplianceItem)}</p></div>
          <div class="record-actions">
            <button class="secondary-button" type="button" data-compliance-view="${escapeAttribute(item.id)}">${icons.view}<span>${isOpen ? "Hide" : "View"}</span></button>
            ${canManage ? `<button class="secondary-button" type="button" data-compliance-edit="${escapeAttribute(item.id)}">${icons.edit}<span>Edit</span></button>` : ""}
            ${canArchive && !item.archived ? `<button class="secondary-button" type="button" data-compliance-archive="${escapeAttribute(item.id)}">${icons.archive}<span>Archive</span></button>` : ""}
          </div>
        </div>
        ${isOpen ? renderRecordDetails([
          ["Description", item.description], ["Due date", formatDateValue(item.dueDate)], ["Responsible person", item.responsiblePerson], ["Related document", item.relatedDocument],
          ["Notes", item.notes], ["Created by", item.createdBy], ["Last updated", formatDateTimeValue(item.lastUpdated)], ["Archived", item.archived ? "Yes" : "No"],
        ]) : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function renderTasksSection() {
    const canManage = state.permissions.canManageTasks;
    const canArchive = state.permissions.canArchiveTasks;
    const canComplete = state.permissions.canCompleteTasks;
    const tasks = getFilteredTasks();
    return `
      <section class="portal-section" id="company-tasks" data-section="company-tasks">
        ${sectionHeader("06", "Company Tasks", "Track founder, director, finance, legal, document, and investor follow-ups with clear ownership.", canManage ? `<button class="secondary-button" type="button" id="create-task">${icons.plus}<span>Add task</span></button>` : `<span class="access-note">Read-only access</span>`)}
        <div class="vault-controls phase3-controls task-controls">
          <label class="visually-hidden" for="task-search">Search tasks</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="task-search" type="search" autocomplete="off" value="${escapeAttribute(state.taskSearch)}" placeholder="Search tasks"></div>
          <select id="task-category-filter" class="select-control" aria-label="Filter tasks by category"><option value="all"${state.taskCategoryFilter === "all" ? " selected" : ""}>All categories</option>${state.taskCategories.map((category) => `<option value="${escapeAttribute(category)}"${state.taskCategoryFilter === category ? " selected" : ""}>${escapeHTML(category)}</option>`).join("")}</select>
          <select id="task-assignee-filter" class="select-control" aria-label="Filter tasks by assignee"><option value="all"${state.taskAssigneeFilter === "all" ? " selected" : ""}>All assignees</option>${getTaskAssignees().map((assignee) => `<option value="${escapeAttribute(assignee)}"${state.taskAssigneeFilter === assignee ? " selected" : ""}>${escapeHTML(assignee)}</option>`).join("")}</select>
          <select id="task-status-filter" class="select-control" aria-label="Filter tasks by status"><option value="all"${state.taskStatusFilter === "all" ? " selected" : ""}>All statuses</option>${state.taskStatuses.map((status) => `<option value="${escapeAttribute(status)}"${state.taskStatusFilter === status ? " selected" : ""}>${escapeHTML(status)}</option>`).join("")}</select>
          <select id="task-priority-filter" class="select-control" aria-label="Filter tasks by priority"><option value="all"${state.taskPriorityFilter === "all" ? " selected" : ""}>All priorities</option>${state.taskPriorities.map((priority) => `<option value="${escapeAttribute(priority)}"${state.taskPriorityFilter === priority ? " selected" : ""}>${escapeHTML(priority)}</option>`).join("")}</select>
          <select id="task-sort" class="select-control" aria-label="Sort tasks"><option value="due-asc"${state.taskSort === "due-asc" ? " selected" : ""}>Due date ascending</option><option value="due-desc"${state.taskSort === "due-desc" ? " selected" : ""}>Due date descending</option><option value="updated-desc"${state.taskSort === "updated-desc" ? " selected" : ""}>Recently updated</option></select>
        </div>
        ${state.taskMode !== "idle" ? renderTaskForm() : ""}
        <div class="panel records-panel">${tasks.length > 0 ? renderTaskList(tasks, canManage, canArchive, canComplete) : renderEmptyBlock("Company Tasks", EMPTY_TASKS_TEXT)}</div>
      </section>`;
  }

  function renderTaskForm() {
    const draft = state.taskDraft;
    const errors = state.taskErrors;
    const title = state.taskMode === "edit" ? "Edit company task" : "Add company task";
    return `
      <form class="panel enterprise-form record-form" id="task-form" novalidate>
        <div class="panel-heading"><div><h3>${escapeHTML(title)}</h3><p>Use ownership, priority, due date, and related context so pending actions remain clear.</p></div><button class="icon-button" type="button" id="cancel-task" aria-label="Cancel task form">${icons.close}</button></div>
        <div class="form-grid">
          ${textInput("taskTitle", "Task title", draft.taskTitle, errors.taskTitle, { required: true })}
          ${selectInput("category", "Category", draft.category, state.taskCategories.map((category) => ({ value: category, label: category })), errors.category, { required: true, placeholder: "Select category" })}
          ${selectInput("status", "Status", draft.status, state.taskStatuses.map((status) => ({ value: status, label: status })), errors.status, { required: true })}
          ${selectInput("priority", "Priority", draft.priority, state.taskPriorities.map((priority) => ({ value: priority, label: priority })), errors.priority, { required: true })}
          ${textInput("assignedTo", "Assigned to", draft.assignedTo, errors.assignedTo)}
          ${textInput("dueDate", "Due date", draft.dueDate, errors.dueDate, { type: "date" })}
          ${textInput("relatedSection", "Related section", draft.relatedSection, errors.relatedSection)}
          ${textInput("relatedDocument", "Related document", draft.relatedDocument, errors.relatedDocument)}
          ${textareaInput("description", "Description", draft.description, errors.description)}
          ${textareaInput("notes", "Notes", draft.notes, errors.notes)}
        </div>
        <div class="form-actions"><button class="primary-button" type="submit">${icons.save}<span>Save task</span></button><button class="secondary-button" type="button" id="cancel-task-secondary">Cancel</button></div>
      </form>`;
  }

  function renderTaskList(tasks, canManage, canArchive, canComplete) {
    return `<div class="record-list">${tasks.map((task) => {
      const isOpen = state.openTaskId === task.id;
      const canMarkDone = canComplete && task.status !== "Done" && task.status !== "Archived";
      return `<article class="record-card printable-record">
        <div class="record-card-header">
          <div><p class="overline">${escapeHTML(task.category)}</p><h3>${escapeHTML(task.taskTitle)}</h3><p>${renderStatusValue(task.status)} ${renderPriorityValue(task.priority)} ${renderDueIndicator(task, isOpenTask)}</p></div>
          <div class="record-actions">
            <button class="secondary-button" type="button" data-task-view="${escapeAttribute(task.id)}">${icons.view}<span>${isOpen ? "Hide" : "View"}</span></button>
            ${canMarkDone ? `<button class="secondary-button" type="button" data-task-done="${escapeAttribute(task.id)}">${icons.check}<span>Mark done</span></button>` : ""}
            ${canManage ? `<button class="secondary-button" type="button" data-task-edit="${escapeAttribute(task.id)}">${icons.edit}<span>Edit</span></button>` : ""}
            ${canArchive && task.status !== "Archived" ? `<button class="secondary-button" type="button" data-task-archive="${escapeAttribute(task.id)}">${icons.archive}<span>Archive</span></button>` : ""}
          </div>
        </div>
        ${isOpen ? renderRecordDetails([
          ["Description", task.description], ["Assigned to", task.assignedTo], ["Due date", formatDateValue(task.dueDate)], ["Related section", task.relatedSection],
          ["Related document", task.relatedDocument], ["Notes", task.notes], ["Created by", task.createdBy], ["Last updated", formatDateTimeValue(task.lastUpdated)],
        ]) : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function bindWorkspaceEvents() {
    document.getElementById("print-button")?.addEventListener("click", () => window.print());
    document.getElementById("logout-button")?.addEventListener("click", logout);
    document.querySelectorAll("[data-theme-option]").forEach((button) => button.addEventListener("click", () => applyTheme(button.dataset.themeOption)));
    bindProfileEvents();
    bindDocumentEvents();
    bindMeetingEvents();
    bindFinancialEvents();
    bindComplianceEvents();
    bindTaskEvents();
    bindProductEvents();
    bindEcosystemEvents();
    bindContactEvents();
    bindAuditEvents();
    bindSettingsEvents();
  }

  function bindProfileEvents() {
    document.getElementById("edit-profile")?.addEventListener("click", () => {
      state.isEditingProfile = true;
      state.profileDraft = clone(state.profile);
      state.profileErrors = {};
      state.flash = "";
      render();
    });
    document.getElementById("cancel-profile")?.addEventListener("click", () => {
      state.isEditingProfile = false;
      state.profileDraft = null;
      state.profileErrors = {};
      render();
    });
    document.getElementById("profile-form")?.addEventListener("submit", saveProfile);
  }

  function bindDocumentEvents() {
    document.getElementById("document-search")?.addEventListener("input", (event) => { state.docSearch = event.target.value; render(); });
    document.getElementById("category-filter")?.addEventListener("change", (event) => { state.docCategory = event.target.value; render(); });
    document.querySelectorAll("[data-category-card]").forEach((button) => button.addEventListener("click", () => { state.docCategory = button.dataset.categoryCard; render(); }));
    document.getElementById("open-upload")?.addEventListener("click", () => { state.isUploadOpen = true; state.uploadMessage = ""; state.uploadErrors = {}; render(); });
    document.getElementById("close-upload")?.addEventListener("click", () => { state.isUploadOpen = false; render(); });
    document.getElementById("cancel-upload")?.addEventListener("click", () => { state.isUploadOpen = false; render(); });
    document.getElementById("upload-form")?.addEventListener("submit", submitUploadPlaceholder);
    document.querySelectorAll("[data-doc-action]").forEach((button) => button.addEventListener("click", () => runDocumentPlaceholder(button.dataset.docAction, button.dataset.docId)));
  }

  function bindMeetingEvents() {
    document.getElementById("meeting-search")?.addEventListener("input", (event) => { state.meetingSearch = event.target.value; render(); });
    document.getElementById("meeting-type-filter")?.addEventListener("change", (event) => { state.meetingTypeFilter = event.target.value; render(); });
    document.getElementById("meeting-status-filter")?.addEventListener("change", (event) => { state.meetingStatusFilter = event.target.value; render(); });
    document.getElementById("create-meeting")?.addEventListener("click", () => {
      state.meetingMode = "create";
      state.meetingDraft = defaultMeetingDraft();
      state.meetingErrors = {};
      state.flash = "";
      render();
    });
    document.getElementById("cancel-meeting")?.addEventListener("click", closeMeetingForm);
    document.getElementById("cancel-meeting-secondary")?.addEventListener("click", closeMeetingForm);
    document.getElementById("meeting-form")?.addEventListener("submit", saveMeeting);
    document.querySelectorAll("[data-meeting-view]").forEach((button) => button.addEventListener("click", () => { state.openMeetingId = state.openMeetingId === button.dataset.meetingView ? "" : button.dataset.meetingView; render(); }));
    document.querySelectorAll("[data-meeting-edit]").forEach((button) => button.addEventListener("click", () => {
      const meeting = state.meetings.find((item) => item.id === button.dataset.meetingEdit);
      if (!meeting) return;
      state.meetingMode = "edit";
      state.meetingDraft = meetingToDraft(meeting);
      state.meetingErrors = {};
      state.openMeetingId = meeting.id;
      state.flash = "";
      render();
    }));
    document.querySelectorAll("[data-meeting-archive]").forEach((button) => button.addEventListener("click", () => archiveMeeting(button.dataset.meetingArchive)));
  }

  function bindFinancialEvents() {
    document.getElementById("finance-search")?.addEventListener("input", (event) => { state.financeSearch = event.target.value; render(); });
    document.getElementById("finance-month-filter")?.addEventListener("change", (event) => { state.financeMonthFilter = event.target.value; render(); });
    document.getElementById("create-financial")?.addEventListener("click", () => {
      state.financeMode = "create";
      state.financeDraft = defaultFinancialDraft();
      state.financeErrors = {};
      state.flash = "";
      render();
    });
    document.getElementById("cancel-financial")?.addEventListener("click", closeFinancialForm);
    document.getElementById("cancel-financial-secondary")?.addEventListener("click", closeFinancialForm);
    document.getElementById("financial-form")?.addEventListener("submit", saveFinancialRecord);
    document.querySelectorAll("[data-finance-open]").forEach((button) => button.addEventListener("click", () => { state.financeMonthFilter = "all"; state.openFinancialId = button.dataset.financeOpen; render(); }));
    document.querySelectorAll("[data-finance-edit]").forEach((button) => button.addEventListener("click", () => {
      const record = state.financialRecords.find((item) => item.id === button.dataset.financeEdit);
      if (!record) return;
      state.financeMode = "edit";
      state.financeDraft = financialRecordToDraft(record);
      state.financeErrors = {};
      state.openFinancialId = record.id;
      state.flash = "";
      render();
    }));
  }

  function bindComplianceEvents() {
    document.getElementById("compliance-search")?.addEventListener("input", (event) => { state.complianceSearch = event.target.value; render(); });
    document.getElementById("compliance-category-filter")?.addEventListener("change", (event) => { state.complianceCategoryFilter = event.target.value; render(); });
    document.getElementById("compliance-status-filter")?.addEventListener("change", (event) => { state.complianceStatusFilter = event.target.value; render(); });
    document.getElementById("compliance-priority-filter")?.addEventListener("change", (event) => { state.compliancePriorityFilter = event.target.value; render(); });
    document.getElementById("compliance-sort")?.addEventListener("change", (event) => { state.complianceSort = event.target.value; render(); });
    document.getElementById("create-compliance")?.addEventListener("click", () => {
      state.complianceMode = "create";
      state.complianceDraft = defaultComplianceDraft();
      state.complianceErrors = {};
      state.flash = "";
      render();
    });
    document.getElementById("cancel-compliance")?.addEventListener("click", closeComplianceForm);
    document.getElementById("cancel-compliance-secondary")?.addEventListener("click", closeComplianceForm);
    document.getElementById("compliance-form")?.addEventListener("submit", saveComplianceItem);
    document.querySelectorAll("[data-compliance-view]").forEach((button) => button.addEventListener("click", () => { state.openComplianceId = state.openComplianceId === button.dataset.complianceView ? "" : button.dataset.complianceView; render(); }));
    document.querySelectorAll("[data-compliance-edit]").forEach((button) => button.addEventListener("click", () => {
      const item = state.complianceItems.find((record) => record.id === button.dataset.complianceEdit);
      if (!item) return;
      state.complianceMode = "edit";
      state.complianceDraft = complianceItemToDraft(item);
      state.complianceErrors = {};
      state.openComplianceId = item.id;
      state.flash = "";
      render();
    }));
    document.querySelectorAll("[data-compliance-archive]").forEach((button) => button.addEventListener("click", () => archiveComplianceItem(button.dataset.complianceArchive)));
  }

  function bindTaskEvents() {
    document.getElementById("task-search")?.addEventListener("input", (event) => { state.taskSearch = event.target.value; render(); });
    document.getElementById("task-category-filter")?.addEventListener("change", (event) => { state.taskCategoryFilter = event.target.value; render(); });
    document.getElementById("task-assignee-filter")?.addEventListener("change", (event) => { state.taskAssigneeFilter = event.target.value; render(); });
    document.getElementById("task-status-filter")?.addEventListener("change", (event) => { state.taskStatusFilter = event.target.value; render(); });
    document.getElementById("task-priority-filter")?.addEventListener("change", (event) => { state.taskPriorityFilter = event.target.value; render(); });
    document.getElementById("task-sort")?.addEventListener("change", (event) => { state.taskSort = event.target.value; render(); });
    document.getElementById("create-task")?.addEventListener("click", () => {
      state.taskMode = "create";
      state.taskDraft = defaultTaskDraft();
      state.taskErrors = {};
      state.flash = "";
      render();
    });
    document.getElementById("cancel-task")?.addEventListener("click", closeTaskForm);
    document.getElementById("cancel-task-secondary")?.addEventListener("click", closeTaskForm);
    document.getElementById("task-form")?.addEventListener("submit", saveTask);
    document.querySelectorAll("[data-task-view]").forEach((button) => button.addEventListener("click", () => { state.openTaskId = state.openTaskId === button.dataset.taskView ? "" : button.dataset.taskView; render(); }));
    document.querySelectorAll("[data-task-edit]").forEach((button) => button.addEventListener("click", () => {
      const task = state.tasks.find((record) => record.id === button.dataset.taskEdit);
      if (!task) return;
      state.taskMode = "edit";
      state.taskDraft = taskToDraft(task);
      state.taskErrors = {};
      state.openTaskId = task.id;
      state.flash = "";
      render();
    }));
    document.querySelectorAll("[data-task-done]").forEach((button) => button.addEventListener("click", () => markTaskDone(button.dataset.taskDone)));
    document.querySelectorAll("[data-task-archive]").forEach((button) => button.addEventListener("click", () => archiveTask(button.dataset.taskArchive)));
  }

  function closeMeetingForm() { state.meetingMode = "idle"; state.meetingDraft = null; state.meetingErrors = {}; render(); }
  function closeFinancialForm() { state.financeMode = "idle"; state.financeDraft = null; state.financeErrors = {}; render(); }
  function closeComplianceForm() { state.complianceMode = "idle"; state.complianceDraft = null; state.complianceErrors = {}; render(); }
  function closeTaskForm() { state.taskMode = "idle"; state.taskDraft = null; state.taskErrors = {}; render(); }

  async function saveProfile(event) {
    event.preventDefault();
    const profile = readProfileForm(event.currentTarget);
    const errors = validateProfile(profile);
    if (Object.keys(errors).length > 0) { state.profileDraft = profile; state.profileErrors = errors; render(); return; }
    state.isSavingProfile = true;
    render();
    try {
      const result = await requestJSON("/api/company-profile", { method: "PUT", body: JSON.stringify(profile) });
      state.profile = result.profile;
      state.company = result.company;
      state.isEditingProfile = false;
      state.profileDraft = null;
      state.flash = "Company profile changes were saved.";
    } catch (error) {
      state.profileErrors = error.details || {};
      state.flash = error.message || "Profile changes could not be saved.";
    } finally {
      state.isSavingProfile = false;
      render();
    }
  }

  async function submitUploadPlaceholder(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = { title: clean(formData.get("documentTitle")), categoryId: clean(formData.get("documentCategory")), type: clean(formData.get("documentType")), version: clean(formData.get("documentVersion")) };
    const errors = {};
    if (!payload.title) errors.documentTitle = "Document title is required.";
    if (!payload.categoryId) errors.documentCategory = "Document category is required.";
    if (Object.keys(errors).length > 0) { state.uploadErrors = errors; render(); return; }
    try {
      const result = await requestJSON("/api/documents/upload-placeholder", { method: "POST", body: JSON.stringify(payload) });
      state.uploadErrors = {};
      state.uploadMessage = result.message;
      render();
    } catch (error) {
      state.uploadErrors = error.details || {};
      state.uploadMessage = error.message || "The upload placeholder could not be prepared.";
      render();
    }
  }

  async function runDocumentPlaceholder(action, documentId) {
    try {
      const result = await requestJSON(`/api/documents/${encodeURIComponent(documentId)}/${encodeURIComponent(action)}`, { method: "POST" });
      state.flash = result.message;
      render();
    } catch (error) {
      state.flash = error.message || "The document action is not available yet.";
      render();
    }
  }

  async function saveMeeting(event) {
    event.preventDefault();
    const meeting = readMeetingForm(event.currentTarget);
    const errors = validateMeeting(meeting);
    if (Object.keys(errors).length > 0) { state.meetingDraft = meeting; state.meetingErrors = errors; render(); return; }
    const isEdit = state.meetingMode === "edit" && state.meetingDraft && state.meetingDraft.id;
    const url = isEdit ? `/api/board-meetings/${encodeURIComponent(state.meetingDraft.id)}` : "/api/board-meetings";
    const method = isEdit ? "PUT" : "POST";
    try {
      const result = await requestJSON(url, { method, body: JSON.stringify(meeting) });
      state.meetings = result.boardMeetings || state.meetings;
      state.meetingMode = "idle";
      state.meetingDraft = null;
      state.meetingErrors = {};
      state.openMeetingId = result.meeting ? result.meeting.id : state.openMeetingId;
      state.flash = result.message;
      render();
    } catch (error) {
      state.meetingErrors = error.details || {};
      state.flash = error.message || "Meeting record could not be saved.";
      render();
    }
  }

  async function archiveMeeting(id) {
    if (!window.confirm("Archive this board meeting record?")) return;
    try {
      const result = await requestJSON(`/api/board-meetings/${encodeURIComponent(id)}/archive`, { method: "POST" });
      state.meetings = result.boardMeetings || state.meetings;
      state.flash = result.message;
      render();
    } catch (error) {
      state.flash = error.message || "Meeting record could not be archived.";
      render();
    }
  }

  async function saveFinancialRecord(event) {
    event.preventDefault();
    const record = readFinancialForm(event.currentTarget);
    const errors = validateFinancialDraft(record);
    if (Object.keys(errors).length > 0) { state.financeDraft = record; state.financeErrors = errors; render(); return; }
    const isEdit = state.financeMode === "edit" && state.financeDraft && state.financeDraft.id;
    const url = isEdit ? `/api/financial-records/${encodeURIComponent(state.financeDraft.id)}` : "/api/financial-records";
    const method = isEdit ? "PUT" : "POST";
    try {
      const result = await requestJSON(url, { method, body: JSON.stringify(record) });
      state.financialRecords = result.financialRecords || state.financialRecords;
      state.financeMode = "idle";
      state.financeDraft = null;
      state.financeErrors = {};
      state.openFinancialId = result.financialRecord ? result.financialRecord.id : state.openFinancialId;
      state.flash = result.message;
      render();
    } catch (error) {
      state.financeErrors = error.details || {};
      state.flash = error.message || "Financial record could not be saved.";
      render();
    }
  }

  async function saveComplianceItem(event) {
    event.preventDefault();
    const complianceItem = readComplianceForm(event.currentTarget);
    const errors = validateComplianceDraft(complianceItem);
    if (Object.keys(errors).length > 0) { state.complianceDraft = complianceItem; state.complianceErrors = errors; render(); return; }
    const isEdit = state.complianceMode === "edit" && state.complianceDraft && state.complianceDraft.id;
    const url = isEdit ? `/api/compliance-items/${encodeURIComponent(state.complianceDraft.id)}` : "/api/compliance-items";
    const method = isEdit ? "PUT" : "POST";
    try {
      const result = await requestJSON(url, { method, body: JSON.stringify(complianceItem) });
      state.complianceItems = result.complianceItems || state.complianceItems;
      state.complianceMode = "idle";
      state.complianceDraft = null;
      state.complianceErrors = {};
      state.openComplianceId = result.complianceItem ? result.complianceItem.id : state.openComplianceId;
      state.flash = result.message;
      render();
    } catch (error) {
      state.complianceErrors = error.details || {};
      state.flash = error.message || "Compliance item could not be saved.";
      render();
    }
  }

  async function archiveComplianceItem(id) {
    if (!window.confirm("Archive this compliance item?")) return;
    try {
      const result = await requestJSON(`/api/compliance-items/${encodeURIComponent(id)}/archive`, { method: "POST" });
      state.complianceItems = result.complianceItems || state.complianceItems;
      state.flash = result.message;
      render();
    } catch (error) {
      state.flash = error.message || "Compliance item could not be archived.";
      render();
    }
  }

  async function saveTask(event) {
    event.preventDefault();
    const task = readTaskForm(event.currentTarget);
    const errors = validateTaskDraft(task);
    if (Object.keys(errors).length > 0) { state.taskDraft = task; state.taskErrors = errors; render(); return; }
    const isEdit = state.taskMode === "edit" && state.taskDraft && state.taskDraft.id;
    const url = isEdit ? `/api/tasks/${encodeURIComponent(state.taskDraft.id)}` : "/api/tasks";
    const method = isEdit ? "PUT" : "POST";
    try {
      const result = await requestJSON(url, { method, body: JSON.stringify(task) });
      state.tasks = result.tasks || state.tasks;
      state.taskMode = "idle";
      state.taskDraft = null;
      state.taskErrors = {};
      state.openTaskId = result.task ? result.task.id : state.openTaskId;
      state.flash = result.message;
      render();
    } catch (error) {
      state.taskErrors = error.details || {};
      state.flash = error.message || "Company task could not be saved.";
      render();
    }
  }

  async function markTaskDone(id) {
    try {
      const result = await requestJSON(`/api/tasks/${encodeURIComponent(id)}/done`, { method: "POST" });
      state.tasks = result.tasks || state.tasks;
      state.flash = result.message;
      render();
    } catch (error) {
      state.flash = error.message || "Company task could not be marked done.";
      render();
    }
  }

  async function archiveTask(id) {
    if (!window.confirm("Archive this company task?")) return;
    try {
      const result = await requestJSON(`/api/tasks/${encodeURIComponent(id)}/archive`, { method: "POST" });
      state.tasks = result.tasks || state.tasks;
      state.flash = result.message;
      render();
    } catch (error) {
      state.flash = error.message || "Company task could not be archived.";
      render();
    }
  }

  async function logout() {
    await requestJSON("/api/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/login");
  }

  function getProfileFields(profile) {
    return [
      ["Company name", profile.companyName], ["CIN", profile.cin], ["PAN", profile.pan], ["TAN", profile.tan],
      ["Registered office address", profile.registeredOfficeAddress], ["Email", profile.email], ["Phone", profile.phone],
      ["Date of incorporation", formatDateValue(profile.dateOfIncorporation)], ["Authorized capital", profile.authorizedCapital],
      ["Paid-up capital", profile.paidUpCapital], ["Directors", profile.directors], ["Shareholders", profile.shareholders],
      ["Company status", profile.companyStatus], ["Last updated date", formatDateValue(profile.lastUpdatedDate)],
    ].map(([label, value]) => ({ label, value }));
  }

  function readProfileForm(form) {
    const formData = new FormData(form);
    return {
      companyName: clean(formData.get("companyName")), cin: clean(formData.get("cin")).toUpperCase(), pan: clean(formData.get("pan")).toUpperCase(), tan: clean(formData.get("tan")).toUpperCase(),
      registeredOfficeAddress: clean(formData.get("registeredOfficeAddress")), email: clean(formData.get("email")), phone: clean(formData.get("phone")), dateOfIncorporation: clean(formData.get("dateOfIncorporation")),
      authorizedCapital: clean(formData.get("authorizedCapital")), paidUpCapital: clean(formData.get("paidUpCapital")), directors: linesToArray(formData.get("directors")), shareholders: linesToArray(formData.get("shareholders")),
      companyStatus: clean(formData.get("companyStatus")), lastUpdatedDate: clean(formData.get("lastUpdatedDate")),
    };
  }

  function validateProfile(profile) {
    const errors = {};
    if (!profile.companyName) errors.companyName = "Company name is required.";
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) errors.email = "Enter a valid email address.";
    if (profile.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(profile.pan)) errors.pan = "Enter a valid PAN format.";
    return errors;
  }

  function readMeetingForm(form) {
    const formData = new FormData(form);
    return {
      meetingTitle: clean(formData.get("meetingTitle")), meetingDate: clean(formData.get("meetingDate")), meetingType: clean(formData.get("meetingType")), attendees: linesToArray(formData.get("attendees")), agenda: linesToArray(formData.get("agenda")),
      discussionNotes: clean(formData.get("discussionNotes")), decisionsTaken: clean(formData.get("decisionsTaken")), boardResolutions: clean(formData.get("boardResolutions")), actionItems: linesToArray(formData.get("actionItems")),
      actionOwner: clean(formData.get("actionOwner")), dueDate: clean(formData.get("dueDate")), status: clean(formData.get("status")), nextMeetingDate: clean(formData.get("nextMeetingDate")), attachmentsPlaceholder: clean(formData.get("attachmentsPlaceholder")),
    };
  }

  function validateMeeting(meeting) {
    const errors = {};
    if (!meeting.meetingTitle) errors.meetingTitle = "Meeting title is required.";
    if (!meeting.meetingDate) errors.meetingDate = "Meeting date is required.";
    if (!meeting.agenda || meeting.agenda.length === 0) errors.agenda = "At least one agenda item is required.";
    if (meeting.actionItems && meeting.actionItems.length > 0 && !meeting.actionOwner) errors.actionOwner = "Action owner is required when action items exist.";
    return errors;
  }

  function defaultMeetingDraft() {
    return { meetingTitle: "", meetingDate: "", meetingType: state.meetingTypes[0] || "Other", attendees: [], agenda: [], discussionNotes: "", decisionsTaken: "", boardResolutions: "", actionItems: [], actionOwner: "", dueDate: "", status: state.meetingStatuses[0] || "Draft", nextMeetingDate: "", attachmentsPlaceholder: "" };
  }

  function meetingToDraft(meeting) {
    return {
      id: meeting.id,
      meetingTitle: valueString(meeting.meetingTitle), meetingDate: valueString(meeting.meetingDate), meetingType: valueString(meeting.meetingType), attendees: meeting.attendees || [], agenda: meeting.agenda || [],
      discussionNotes: valueString(meeting.discussionNotes), decisionsTaken: valueString(meeting.decisionsTaken), boardResolutions: valueString(meeting.boardResolutions), actionItems: meeting.actionItems || [],
      actionOwner: valueString(meeting.actionOwner), dueDate: valueString(meeting.dueDate), status: valueString(meeting.status), nextMeetingDate: valueString(meeting.nextMeetingDate), attachmentsPlaceholder: valueString(meeting.attachmentsPlaceholder),
    };
  }

  function readFinancialForm(form) {
    const formData = new FormData(form);
    return {
      reportingMonth: clean(formData.get("reportingMonth")), revenue: clean(formData.get("revenue")), expenses: clean(formData.get("expenses")), cashBalance: clean(formData.get("cashBalance")), receivables: clean(formData.get("receivables")), payables: clean(formData.get("payables")),
      gstCollected: clean(formData.get("gstCollected")), gstPaid: clean(formData.get("gstPaid")), cloudSoftwareSubscriptions: clean(formData.get("cloudSoftwareSubscriptions")), vendorPayments: clean(formData.get("vendorPayments")), directorRemuneration: clean(formData.get("directorRemuneration")), founderNotes: clean(formData.get("founderNotes")),
    };
  }

  function validateFinancialDraft(record) {
    const errors = {};
    if (!/^\d{4}-\d{2}$/.test(record.reportingMonth)) errors.reportingMonth = "Reporting month is required.";
    ["revenue", "expenses", "gstCollected", "gstPaid"].forEach((field) => { if (record[field] === "" || !Number.isFinite(Number(record[field]))) errors[field] = "Enter a valid number."; });
    ["cashBalance", "receivables", "payables", "cloudSoftwareSubscriptions", "vendorPayments", "directorRemuneration"].forEach((field) => { if (record[field] !== "" && !Number.isFinite(Number(record[field]))) errors[field] = "Enter a valid number."; });
    return errors;
  }

  function defaultFinancialDraft() {
    return { reportingMonth: "", revenue: "", expenses: "", cashBalance: "", receivables: "", payables: "", gstCollected: "", gstPaid: "", cloudSoftwareSubscriptions: "", vendorPayments: "", directorRemuneration: "", founderNotes: "" };
  }

  function financialRecordToDraft(record) {
    return {
      id: record.id,
      reportingMonth: valueString(record.reportingMonth), revenue: valueString(record.revenue), expenses: valueString(record.expenses), cashBalance: valueString(record.cashBalance), receivables: valueString(record.receivables), payables: valueString(record.payables),
      gstCollected: valueString(record.gstCollected), gstPaid: valueString(record.gstPaid), cloudSoftwareSubscriptions: valueString(record.cloudSoftwareSubscriptions), vendorPayments: valueString(record.vendorPayments), directorRemuneration: valueString(record.directorRemuneration), founderNotes: valueString(record.founderNotes),
    };
  }

  function readComplianceForm(form) {
    const formData = new FormData(form);
    return {
      complianceTitle: clean(formData.get("complianceTitle")), category: clean(formData.get("category")), description: clean(formData.get("description")), dueDate: clean(formData.get("dueDate")), status: clean(formData.get("status")), priority: clean(formData.get("priority")), responsiblePerson: clean(formData.get("responsiblePerson")), relatedDocument: clean(formData.get("relatedDocument")), notes: clean(formData.get("notes")),
    };
  }

  function validateComplianceDraft(item) {
    const errors = {};
    if (!item.complianceTitle) errors.complianceTitle = "Compliance title is required.";
    if (!item.category) errors.category = "Category is required.";
    if (!item.status) errors.status = "Status is required.";
    if (item.status !== "Not Applicable" && !item.dueDate) errors.dueDate = "Due date is required when compliance is applicable.";
    if (item.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) errors.dueDate = "Enter a valid due date.";
    if (isActiveComplianceStatus(item.status) && !item.responsiblePerson) errors.responsiblePerson = "Responsible person is required for active compliance items.";
    return errors;
  }

  function defaultComplianceDraft() {
    return { complianceTitle: "", category: "", description: "", dueDate: "", status: state.complianceStatuses[0] || "Not Started", priority: state.compliancePriorities[1] || "Medium", responsiblePerson: "", relatedDocument: "", notes: "" };
  }

  function complianceItemToDraft(item) {
    return { id: item.id, complianceTitle: valueString(item.complianceTitle), category: valueString(item.category), description: valueString(item.description), dueDate: valueString(item.dueDate), status: valueString(item.status), priority: valueString(item.priority), responsiblePerson: valueString(item.responsiblePerson), relatedDocument: valueString(item.relatedDocument), notes: valueString(item.notes) };
  }

  function readTaskForm(form) {
    const formData = new FormData(form);
    return {
      taskTitle: clean(formData.get("taskTitle")), category: clean(formData.get("category")), description: clean(formData.get("description")), assignedTo: clean(formData.get("assignedTo")), dueDate: clean(formData.get("dueDate")), priority: clean(formData.get("priority")), status: clean(formData.get("status")), relatedSection: clean(formData.get("relatedSection")), relatedDocument: clean(formData.get("relatedDocument")), notes: clean(formData.get("notes")),
    };
  }

  function validateTaskDraft(task) {
    const errors = {};
    if (!task.taskTitle) errors.taskTitle = "Task title is required.";
    if (!task.category) errors.category = "Category is required.";
    if (!task.status) errors.status = "Status is required.";
    if (isActiveTask(task) && !task.assignedTo) errors.assignedTo = "Assigned person is required when task is active.";
    if ((task.priority === "High" || task.priority === "Critical") && !task.dueDate) errors.dueDate = "Due date is required for high or critical priority tasks.";
    if (task.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) errors.dueDate = "Enter a valid due date.";
    return errors;
  }

  function defaultTaskDraft() {
    return { taskTitle: "", category: "", description: "", assignedTo: "", dueDate: "", priority: state.taskPriorities[1] || "Medium", status: state.taskStatuses[0] || "To Do", relatedSection: "", relatedDocument: "", notes: "" };
  }

  function taskToDraft(task) {
    return { id: task.id, taskTitle: valueString(task.taskTitle), category: valueString(task.category), description: valueString(task.description), assignedTo: valueString(task.assignedTo), dueDate: valueString(task.dueDate), priority: valueString(task.priority), status: valueString(task.status), relatedSection: valueString(task.relatedSection), relatedDocument: valueString(task.relatedDocument), notes: valueString(task.notes) };
  }

  function getFilteredDocuments() {
    const search = state.docSearch.trim().toLowerCase();
    return state.documents.filter((item) => {
      const inCategory = state.docCategory === "all" || item.categoryId === state.docCategory;
      const text = [item.title, item.type, item.uploadedBy, item.status, item.version, getCategoryName(item.categoryId)].join(" ").toLowerCase();
      return inCategory && (!search || text.includes(search));
    });
  }

  function getFilteredMeetings() {
    const search = state.meetingSearch.trim().toLowerCase();
    return state.meetings.filter((meeting) => {
      const typeMatch = state.meetingTypeFilter === "all" || meeting.meetingType === state.meetingTypeFilter;
      const statusMatch = state.meetingStatusFilter === "all" || meeting.status === state.meetingStatusFilter;
      const text = [meeting.meetingTitle, meeting.meetingType, meeting.status, meeting.createdBy, meeting.discussionNotes, meeting.decisionsTaken, meeting.boardResolutions, ...(meeting.agenda || []), ...(meeting.actionItems || [])].join(" ").toLowerCase();
      return typeMatch && statusMatch && (!search || text.includes(search));
    });
  }

  function getFilteredFinancialRecords() {
    const search = state.financeSearch.trim().toLowerCase();
    return state.financialRecords.filter((record) => {
      const monthMatch = state.financeMonthFilter === "all" || record.reportingMonth === state.financeMonthFilter;
      const text = [record.reportingMonth, formatMonth(record.reportingMonth), record.founderNotes, record.createdBy].join(" ").toLowerCase();
      return monthMatch && (!search || text.includes(search));
    }).sort((a, b) => String(b.reportingMonth).localeCompare(String(a.reportingMonth)));
  }

  function getFocusFinancialRecord(records) {
    if (records.length === 0) return null;
    const explicit = records.find((record) => record.id === state.openFinancialId);
    if (explicit) return explicit;
    if (state.financeMonthFilter !== "all") return records[0];
    return [...records].sort((a, b) => String(b.reportingMonth).localeCompare(String(a.reportingMonth)))[0];
  }

  function getFinancialMonths() {
    return [...new Set(state.financialRecords.map((record) => record.reportingMonth).filter(Boolean))].sort().reverse();
  }

  function getFilteredComplianceItems() {
    const search = state.complianceSearch.trim().toLowerCase();
    const items = state.complianceItems.filter((item) => {
      const categoryMatch = state.complianceCategoryFilter === "all" || item.category === state.complianceCategoryFilter;
      const statusMatch = state.complianceStatusFilter === "all" || item.status === state.complianceStatusFilter;
      const priorityMatch = state.compliancePriorityFilter === "all" || item.priority === state.compliancePriorityFilter;
      const text = [item.complianceTitle, item.category, item.status, item.priority, item.responsiblePerson, item.relatedDocument, item.description, item.notes, item.createdBy].join(" ").toLowerCase();
      return categoryMatch && statusMatch && priorityMatch && (!search || text.includes(search));
    });
    return sortRecords(items, state.complianceSort);
  }

  function getFilteredTasks() {
    const search = state.taskSearch.trim().toLowerCase();
    const tasks = state.tasks.filter((task) => {
      const categoryMatch = state.taskCategoryFilter === "all" || task.category === state.taskCategoryFilter;
      const assigneeMatch = state.taskAssigneeFilter === "all" || task.assignedTo === state.taskAssigneeFilter;
      const statusMatch = state.taskStatusFilter === "all" || task.status === state.taskStatusFilter;
      const priorityMatch = state.taskPriorityFilter === "all" || task.priority === state.taskPriorityFilter;
      const text = [task.taskTitle, task.category, task.status, task.priority, task.assignedTo, task.relatedSection, task.relatedDocument, task.description, task.notes, task.createdBy].join(" ").toLowerCase();
      return categoryMatch && assigneeMatch && statusMatch && priorityMatch && (!search || text.includes(search));
    });
    return sortRecords(tasks, state.taskSort);
  }

  function sortRecords(records, sortMode) {
    return [...records].sort((a, b) => {
      if (sortMode === "updated-desc") return String(b.lastUpdated || b.createdAt || "").localeCompare(String(a.lastUpdated || a.createdAt || ""));
      const aDue = a.dueDate || "9999-12-31";
      const bDue = b.dueDate || "9999-12-31";
      const order = String(aDue).localeCompare(String(bDue));
      return sortMode === "due-desc" ? -order : order;
    });
  }

  function getOperationalSummary() {
    const openCompliance = state.complianceItems.filter(isOpenComplianceItem);
    const openTasks = state.tasks.filter(isOpenTask);
    const activeProducts = state.products.filter(isActiveProduct);
    const activeContacts = state.contacts.filter(isActiveContact);
    return {
      openCompliance: openCompliance.length,
      overdueCompliance: openCompliance.filter(isOverdue).length,
      upcomingCompliance: openCompliance.filter(isUpcomingDue).length,
      openTasks: openTasks.length,
      overdueTasks: openTasks.filter(isOverdue).length,
      blockedTasks: state.tasks.filter((task) => task.status === "Blocked").length,
      activeProducts: activeProducts.length,
      launchReadyProducts: state.products.filter((product) => !product.archived && product.currentStatus === "Launch Ready").length,
      productRisks: activeProducts.filter((product) => Array.isArray(product.risks) && product.risks.length > 0).length,
      ecosystemRegisteredProducts: state.ecosystemProducts.length,
      ecosystemLiveProducts: state.ecosystemProducts.filter((product) => !product.archived && product.status === "LIVE").length,
      ecosystemRemainingGaps: state.ecosystemProducts.reduce((total, product) => total + getEcosystemGaps(product).length, 0),
      importantContacts: activeContacts.length,
      followUpsDue: state.contacts.filter(isFollowUpDue).length,
      waitingPartnerResponses: state.contacts.filter((contact) => !contact.archived && contact.status === "Waiting").length,
      recentActivity: state.auditLogs.length,
      criticalChanges: state.auditLogs.filter((record) => record.severity === "Critical").length,
      pendingSettingsActions: getPendingSettingsActions().length,
      securityStatus: getSecurityStatus(),
      lastBackupPlaceholder: getLastBackupText(),
    };
  }

  function getTaskAssignees() {
    return [...new Set(state.tasks.map((task) => task.assignedTo).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function isOpenComplianceItem(item) {
    return !item.archived && !COMPLIANCE_CLOSED_STATUSES.has(item.status);
  }

  function isOpenTask(task) {
    return !TASK_CLOSED_STATUSES.has(task.status);
  }

  function isActiveComplianceStatus(status) {
    return Boolean(status) && !COMPLIANCE_CLOSED_STATUSES.has(status);
  }

  function isActiveTask(task) {
    return Boolean(task.status) && !TASK_CLOSED_STATUSES.has(task.status);
  }

  function isOverdue(record) {
    const days = daysUntil(record.dueDate);
    return days !== null && days < 0;
  }

  function isUpcomingDue(record) {
    const days = daysUntil(record.dueDate);
    return days !== null && days >= 0 && days <= DUE_SOON_DAYS;
  }

  function daysUntil(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${value}T00:00:00`);
    if (Number.isNaN(due.getTime())) return null;
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  }

  function renderDueIndicator(record, isOpenPredicate) {
    if (!record.dueDate || !isOpenPredicate(record)) return "";
    const days = daysUntil(record.dueDate);
    if (days === null) return "";
    if (days < 0) return `<span class="status-pill is-error due-indicator">Overdue</span>`;
    if (days <= DUE_SOON_DAYS) return `<span class="status-pill is-warning due-indicator">Due soon</span>`;
    return `<span class="status-pill due-indicator">Upcoming</span>`;
  }

  function sectionHeader(index, title, summary, actions) {
    return `<div class="section-heading static-heading"><span class="section-title-group"><span class="section-index">${escapeHTML(index)}</span><span><span class="section-title">${escapeHTML(title)}</span><span class="section-summary">${escapeHTML(summary)}</span></span></span><span class="section-actions">${actions || ""}</span></div>`;
  }

  function textInput(name, label, value, error, options) {
    const opts = options || {};
    const attrs = [opts.required ? "required" : "", opts.step ? `step="${escapeAttribute(opts.step)}"` : ""].filter(Boolean).join(" ");
    return `<div class="form-field"><label for="${escapeAttribute(name)}">${escapeHTML(label)}${opts.required ? " <span aria-hidden=\"true\">*</span>" : ""}</label><input id="${escapeAttribute(name)}" name="${escapeAttribute(name)}" type="${escapeAttribute(opts.type || "text")}" value="${escapeAttribute(valueString(value))}" ${attrs}><p class="field-error">${escapeHTML(error || "")}</p></div>`;
  }

  function selectInput(name, label, value, options, error, config) {
    const opts = config || {};
    return `<div class="form-field"><label for="${escapeAttribute(name)}">${escapeHTML(label)}${opts.required ? " <span aria-hidden=\"true\">*</span>" : ""}</label><select id="${escapeAttribute(name)}" name="${escapeAttribute(name)}" ${opts.required ? "required" : ""}>${opts.placeholder ? `<option value="">${escapeHTML(opts.placeholder)}</option>` : ""}${options.map((option) => `<option value="${escapeAttribute(option.value)}"${value === option.value ? " selected" : ""}>${escapeHTML(option.label)}</option>`).join("")}</select><p class="field-error">${escapeHTML(error || "")}</p></div>`;
  }

  function textareaInput(name, label, value, error, help) {
    return `<div class="form-field full-span"><label for="${escapeAttribute(name)}">${escapeHTML(label)}</label><textarea id="${escapeAttribute(name)}" name="${escapeAttribute(name)}" rows="4">${escapeHTML(valueString(value))}</textarea>${help ? `<p class="field-help">${escapeHTML(help)}</p>` : ""}<p class="field-error">${escapeHTML(error || "")}</p></div>`;
  }

  function renderRecordDetails(fields) {
    return `<dl class="record-detail-grid">${fields.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${renderDisplayValue(value)}</dd></div>`).join("")}</dl>`;
  }

  function renderDisplayValue(value) {
    if (Array.isArray(value)) {
      if (value.length === 0) return `<span class="empty-value">${EMPTY_TEXT}</span>`;
      return `<ul class="compact-list">${value.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`;
    }
    if (isEmpty(value) || value === EMPTY_TEXT) return `<span class="empty-value">${EMPTY_TEXT}</span>`;
    return escapeHTML(value);
  }

  function renderStatusValue(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return `<span class="status-pill is-empty">${EMPTY_TEXT}</span>`;
    let tone = "";
    if (["complete", "active", "filed", "paid", "approved", "available", "completed", "done", "submitted"].includes(normalized)) tone = " is-success";
    else if (["pending", "in progress", "due", "review", "scheduled", "action pending", "draft", "to do", "waiting", "waiting for ca", "waiting for director", "not started"].includes(normalized)) tone = " is-warning";
    else if (["overdue", "blocked", "failed", "expired", "archived", "rejected"].includes(normalized)) tone = " is-error";
    return `<span class="status-pill${tone}">${escapeHTML(value)}</span>`;
  }

  function renderPriorityValue(value) {
    const normalized = String(value || "").toLowerCase();
    const tone = normalized === "critical" || normalized === "high" ? " is-error" : normalized === "medium" ? " is-warning" : "";
    return `<span class="status-pill priority-pill${tone}">${escapeHTML(value || EMPTY_TEXT)}</span>`;
  }

  function renderMoneyBadge(value) {
    const number = Number(value || 0);
    const tone = number < 0 ? " is-error" : number > 0 ? " is-success" : "";
    return `<span class="status-pill${tone}">${escapeHTML(formatCurrency(number))}</span>`;
  }

  function renderEmptyBlock(label, text) {
    return `<div class="empty-block"><p>${escapeHTML(label)}</p><strong>${escapeHTML(text)}</strong></div>`;
  }

  async function requestJSON(url, options) {
    const response = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
    let payload = {};
    try { payload = await response.json(); } catch (_error) { payload = {}; }
    if (!response.ok) {
      const error = new Error(payload.message || "Request failed.");
      error.status = response.status;
      error.details = payload.details || {};
      throw error;
    }
    return payload;
  }

  function setSectionObserver() {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      document.querySelectorAll(".nav-link").forEach((link) => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-120px 0px -60% 0px", threshold: [0.1, 0.25, 0.5] });
    document.querySelectorAll(".portal-section").forEach((section) => observer.observe(section));
  }

  function applyTheme(theme) { const nextTheme = theme === "dark" ? "dark" : "light"; document.documentElement.dataset.theme = nextTheme; localStorage.setItem(STORAGE_KEYS.theme, nextTheme); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function getCategoryName(categoryId) { const category = state.categories.find((item) => item.id === categoryId); return category ? category.name : EMPTY_TEXT; }
  function valueText(value) { return isEmpty(value) ? EMPTY_TEXT : String(value); }
  function isEmpty(value) { return value === null || value === undefined || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0); }
  function clean(value) { return String(value || "").trim(); }
  function valueString(value) { return value === null || value === undefined ? "" : String(value); }
  function linesToArray(value) { return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
  function arrayToLines(value) { return Array.isArray(value) ? value.join("\n") : ""; }
  function formatCurrentDate() { return new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date()); }
  function formatDateValue(value) { if (isEmpty(value)) return EMPTY_TEXT; const date = new Date(`${value}T00:00:00`); if (Number.isNaN(date.getTime())) return String(value); return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date); }
  function formatDateTimeValue(value) { if (isEmpty(value)) return EMPTY_TEXT; const date = new Date(value); if (Number.isNaN(date.getTime())) return String(value); return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date); }
  function formatMonth(value) { if (isEmpty(value)) return EMPTY_TEXT; const date = new Date(`${value}-01T00:00:00`); if (Number.isNaN(date.getTime())) return String(value); return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date); }
  function formatRole(role) { return String(role || "").split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
  function formatEnumLabel(value) { return String(value || "").split(/[_-]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" "); }
  function isValidHttpUrl(value) { try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:"; } catch (_error) { return false; } }
  function formatCurrency(value) { if (value === null || value === undefined || value === "") return EMPTY_TEXT; const number = Number(value); if (!Number.isFinite(number)) return EMPTY_TEXT; return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(number); }
  function moneyTone(value) { const number = Number(value || 0); if (number > 0) return "positive"; if (number < 0) return "negative"; return "neutral"; }
  function calculateDraftProfitLoss(draft) { const revenue = Number(draft.revenue || 0); const expenses = Number(draft.expenses || 0); return Number.isFinite(revenue) && Number.isFinite(expenses) ? revenue - expenses : 0; }
  function calculateDraftNetGst(draft) { const collected = Number(draft.gstCollected || 0); const paid = Number(draft.gstPaid || 0); return Number.isFinite(collected) && Number.isFinite(paid) ? collected - paid : 0; }
  function renderFatal(message) { root.className = "fatal-state"; root.innerHTML = `<section class="auth-card"><p class="overline">Workspace Error</p><h1>KRAVIA PRIVATE LIMITED</h1><p>${escapeHTML(message)}</p><a class="primary-button" href="/login">Return to login</a></section>`; }
  function escapeHTML(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function escapeAttribute(value) { return escapeHTML(value); }
  function renderProductsPortfolio() {
    const canManage = state.permissions.canManageProducts;
    const canArchive = state.permissions.canArchiveProducts;
    const products = getFilteredProducts();
    return `
      <section class="portal-section" id="products-portfolio" data-section="products-portfolio">
        ${sectionHeader("07", "Products Portfolio", "Company-level visibility into product status, readiness, risks, and next milestones.", canManage ? `<button class="secondary-button" type="button" id="create-product">${icons.plus}<span>Add product</span></button>` : `<span class="access-note">Read-only access</span>`)}
        <div class="vault-controls phase4-controls product-controls">
          <label class="visually-hidden" for="product-search">Search products</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="product-search" type="search" autocomplete="off" value="${escapeAttribute(state.productSearch)}" placeholder="Search products"></div>
          <select id="product-status-filter" class="select-control" aria-label="Filter products by status"><option value="all"${state.productStatusFilter === "all" ? " selected" : ""}>All statuses</option>${state.productStatuses.map((status) => `<option value="${escapeAttribute(status)}"${state.productStatusFilter === status ? " selected" : ""}>${escapeHTML(status)}</option>`).join("")}</select>
          <select id="product-stage-filter" class="select-control" aria-label="Filter products by development stage"><option value="all"${state.productStageFilter === "all" ? " selected" : ""}>All stages</option>${state.productStages.map((stage) => `<option value="${escapeAttribute(stage)}"${state.productStageFilter === stage ? " selected" : ""}>${escapeHTML(stage)}</option>`).join("")}</select>
        </div>
        ${state.productMode !== "idle" ? renderProductForm() : ""}
        <div class="panel records-panel">${products.length > 0 ? renderProductsList(products, canManage, canArchive) : renderEmptyBlock("Products Portfolio", EMPTY_PRODUCTS_TEXT)}</div>
      </section>`;
  }

  function renderProductForm() {
    const draft = state.productDraft;
    const errors = state.productErrors;
    const title = state.productMode === "edit" ? "Edit product record" : "Add product record";
    return `
      <form class="panel enterprise-form record-form" id="product-form" novalidate>
        <div class="panel-heading"><div><h3>${escapeHTML(title)}</h3><p>Track product maturity, launch readiness, revenue notes, pending work, risks, and ownership.</p></div><button class="icon-button" type="button" id="cancel-product" aria-label="Cancel product form">${icons.close}</button></div>
        <div class="form-grid">
          ${textInput("productName", "Product name", draft.productName, errors.productName, { required: true })}
          ${selectInput("category", "Category", draft.category, state.productCategories.map((category) => ({ value: category, label: category })), errors.category, { required: true, placeholder: "Select category" })}
          ${selectInput("currentStatus", "Current status", draft.currentStatus, state.productStatuses.map((status) => ({ value: status, label: status })), errors.currentStatus, { required: true })}
          ${selectInput("developmentStage", "Development stage", draft.developmentStage, state.productStages.map((stage) => ({ value: stage, label: stage })), errors.developmentStage, { required: true })}
          ${textInput("launchReadiness", "Launch readiness %", draft.launchReadiness, errors.launchReadiness, { type: "number", step: "1", required: true })}
          ${textInput("responsiblePerson", "Responsible person", draft.responsiblePerson, errors.responsiblePerson)}
          ${textInput("targetUsers", "Target users", draft.targetUsers, errors.targetUsers)}
          ${textInput("nextMilestone", "Next milestone", draft.nextMilestone, errors.nextMilestone)}
          ${textareaInput("description", "Description", draft.description, errors.description)}
          ${textareaInput("pricingNotes", "Pricing notes", draft.pricingNotes, errors.pricingNotes)}
          ${textareaInput("revenueNotes", "Revenue notes", draft.revenueNotes, errors.revenueNotes)}
          ${textareaInput("keyFeatures", "Key features", arrayToLines(draft.keyFeatures), errors.keyFeatures, "Enter one feature per line.")}
          ${textareaInput("pendingWork", "Pending work", arrayToLines(draft.pendingWork), errors.pendingWork, "Enter one item per line.")}
          ${textareaInput("risks", "Risks", arrayToLines(draft.risks), errors.risks, "Enter one risk per line.")}
        </div>
        <div class="readiness-preview">${renderReadinessIndicator(draft.launchReadiness)}</div>
        <div class="form-actions"><button class="primary-button" type="submit">${icons.save}<span>Save product</span></button><button class="secondary-button" type="button" id="cancel-product-secondary">Cancel</button></div>
      </form>`;
  }

  function renderProductsList(products, canManage, canArchive) {
    return `<div class="product-card-grid">${products.map((product) => {
      const isOpen = state.openProductId === product.id;
      return `<article class="record-card product-card printable-record">
        <div class="record-card-header">
          <div><p class="overline">${escapeHTML(product.category)}</p><h3>${escapeHTML(product.productName)}</h3><p>${renderStatusValue(product.currentStatus)} ${renderStatusValue(product.developmentStage)} ${product.archived ? renderStatusValue("Archived") : ""}</p></div>
          <div class="record-actions">
            <button class="secondary-button" type="button" data-product-view="${escapeAttribute(product.id)}">${icons.view}<span>${isOpen ? "Hide" : "View"}</span></button>
            ${canManage ? `<button class="secondary-button" type="button" data-product-edit="${escapeAttribute(product.id)}">${icons.edit}<span>Edit</span></button>` : ""}
            ${canArchive && !product.archived ? `<button class="secondary-button" type="button" data-product-archive="${escapeAttribute(product.id)}">${icons.archive}<span>Archive</span></button>` : ""}
          </div>
        </div>
        ${renderReadinessIndicator(product.launchReadiness)}
        ${isOpen ? renderRecordDetails([
          ["Description", product.description], ["Target users", product.targetUsers], ["Pricing notes", product.pricingNotes], ["Revenue notes", product.revenueNotes],
          ["Key features", product.keyFeatures], ["Pending work", product.pendingWork], ["Risks", product.risks], ["Next milestone", product.nextMilestone],
          ["Responsible person", product.responsiblePerson], ["Created by", product.createdBy], ["Last updated", formatDateTimeValue(product.lastUpdated)], ["Archived", product.archived ? "Yes" : "No"],
        ]) : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function renderContactsPartners() {
    const canManage = state.permissions.canManageContacts;
    const canArchive = state.permissions.canArchiveContacts;
    const contacts = getFilteredContacts();
    return `
      <section class="portal-section" id="contacts-partners" data-section="contacts-partners">
        ${sectionHeader("08", "Contacts & Partners", "Track professional relationships, follow-ups, related records, and partner response status.", canManage ? `<button class="secondary-button" type="button" id="create-contact">${icons.plus}<span>Add contact</span></button>` : `<span class="access-note">Read-only access</span>`)}
        <div class="vault-controls phase4-controls contact-controls">
          <label class="visually-hidden" for="contact-search">Search contacts</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="contact-search" type="search" autocomplete="off" value="${escapeAttribute(state.contactSearch)}" placeholder="Search contacts"></div>
          <select id="contact-category-filter" class="select-control" aria-label="Filter contacts by category"><option value="all"${state.contactCategoryFilter === "all" ? " selected" : ""}>All categories</option>${state.contactCategories.map((category) => `<option value="${escapeAttribute(category)}"${state.contactCategoryFilter === category ? " selected" : ""}>${escapeHTML(category)}</option>`).join("")}</select>
          <select id="contact-status-filter" class="select-control" aria-label="Filter contacts by status"><option value="all"${state.contactStatusFilter === "all" ? " selected" : ""}>All statuses</option>${state.contactStatuses.map((status) => `<option value="${escapeAttribute(status)}"${state.contactStatusFilter === status ? " selected" : ""}>${escapeHTML(status)}</option>`).join("")}</select>
        </div>
        ${state.contactMode !== "idle" ? renderContactForm() : ""}
        <div class="panel contacts-panel">${contacts.length > 0 ? renderContactsTable(contacts, canManage, canArchive) : renderEmptyBlock("Contacts & Partners", EMPTY_CONTACTS_TEXT)}</div>
        ${renderOpenContactDetail(contacts, canManage, canArchive)}
      </section>`;
  }

  function renderContactForm() {
    const draft = state.contactDraft;
    const errors = state.contactErrors;
    const title = state.contactMode === "edit" ? "Edit contact" : "Add contact";
    return `
      <form class="panel enterprise-form record-form" id="contact-form" novalidate>
        <div class="panel-heading"><div><h3>${escapeHTML(title)}</h3><p>Store professional relationship context without creating a generic CRM surface.</p></div><button class="icon-button" type="button" id="cancel-contact" aria-label="Cancel contact form">${icons.close}</button></div>
        <div class="form-grid">
          ${textInput("name", "Name", draft.name, errors.name, { required: true })}
          ${textInput("organization", "Organization", draft.organization, errors.organization)}
          ${textInput("role", "Role", draft.role, errors.role)}
          ${selectInput("category", "Category", draft.category, state.contactCategories.map((category) => ({ value: category, label: category })), errors.category, { required: true, placeholder: "Select category" })}
          ${textInput("phone", "Phone", draft.phone, errors.phone || errors.contactMethod)}
          ${textInput("email", "Email", draft.email, errors.email || errors.contactMethod, { type: "email" })}
          ${selectInput("status", "Status", draft.status, state.contactStatuses.map((status) => ({ value: status, label: status })), errors.status, { required: true })}
          ${textInput("lastContactedDate", "Last contacted date", draft.lastContactedDate, errors.lastContactedDate, { type: "date" })}
          ${textInput("nextFollowUpDate", "Next follow-up date", draft.nextFollowUpDate, errors.nextFollowUpDate, { type: "date" })}
          ${textareaInput("relatedDocuments", "Related documents", arrayToLines(draft.relatedDocuments), errors.relatedDocuments, "Enter one document reference per line.")}
          ${textareaInput("relatedTasks", "Related tasks", arrayToLines(draft.relatedTasks), errors.relatedTasks, "Enter one task reference per line.")}
          ${textareaInput("notes", "Notes", draft.notes, errors.notes)}
        </div>
        <div class="form-actions"><button class="primary-button" type="submit">${icons.save}<span>Save contact</span></button><button class="secondary-button" type="button" id="cancel-contact-secondary">Cancel</button></div>
      </form>`;
  }

  function renderContactsTable(contacts, canManage, canArchive) {
    return `<div class="table-scroll"><table class="contacts-table"><thead><tr><th scope="col">Name</th><th scope="col">Organization</th><th scope="col">Category</th><th scope="col">Contact</th><th scope="col">Status</th><th scope="col">Next follow-up</th><th scope="col">Actions</th></tr></thead><tbody>${contacts.map((contact) => `<tr><td>${escapeHTML(contact.name)}</td><td>${renderDisplayValue(contact.organization)}</td><td>${escapeHTML(contact.category)}</td><td>${renderContactMethods(contact)}</td><td>${renderStatusValue(contact.status)} ${renderFollowUpIndicator(contact)}</td><td>${renderDisplayValue(formatDateValue(contact.nextFollowUpDate))}</td><td><div class="table-actions"><button class="icon-button compact" type="button" data-contact-view="${escapeAttribute(contact.id)}" aria-label="View contact">${icons.view}</button>${canManage ? `<button class="icon-button compact" type="button" data-contact-edit="${escapeAttribute(contact.id)}" aria-label="Edit contact">${icons.edit}</button>` : ""}${canArchive && contact.status !== "Archived" ? `<button class="icon-button compact" type="button" data-contact-archive="${escapeAttribute(contact.id)}" aria-label="Archive contact">${icons.archive}</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderOpenContactDetail(contacts, canManage, canArchive) {
    const contact = contacts.find((item) => item.id === state.openContactId);
    if (!contact) return "";
    return `<article class="record-card printable-record contact-detail-card">
      <div class="record-card-header"><div><p class="overline">${escapeHTML(contact.category)}</p><h3>${escapeHTML(contact.name)}</h3><p>${renderStatusValue(contact.status)} ${renderFollowUpIndicator(contact)}</p></div><div class="record-actions">${canManage ? `<button class="secondary-button" type="button" data-contact-edit="${escapeAttribute(contact.id)}">${icons.edit}<span>Edit</span></button>` : ""}${canArchive && contact.status !== "Archived" ? `<button class="secondary-button" type="button" data-contact-archive="${escapeAttribute(contact.id)}">${icons.archive}<span>Archive</span></button>` : ""}</div></div>
      ${renderRecordDetails([
        ["Organization", contact.organization], ["Role", contact.role], ["Phone", contact.phone], ["Email", contact.email],
        ["Notes", contact.notes], ["Related documents", contact.relatedDocuments], ["Related tasks", contact.relatedTasks], ["Last contacted", formatDateValue(contact.lastContactedDate)],
        ["Next follow-up", formatDateValue(contact.nextFollowUpDate)], ["Created by", contact.createdBy], ["Last updated", formatDateTimeValue(contact.lastUpdated)], ["Archived", contact.archived ? "Yes" : "No"],
      ])}
    </article>`;
  }

  function bindProductEvents() {
    document.getElementById("product-search")?.addEventListener("input", (event) => { state.productSearch = event.target.value; render(); });
    document.getElementById("product-status-filter")?.addEventListener("change", (event) => { state.productStatusFilter = event.target.value; render(); });
    document.getElementById("product-stage-filter")?.addEventListener("change", (event) => { state.productStageFilter = event.target.value; render(); });
    document.getElementById("create-product")?.addEventListener("click", () => { state.productMode = "create"; state.productDraft = defaultProductDraft(); state.productErrors = {}; state.flash = ""; render(); });
    document.getElementById("cancel-product")?.addEventListener("click", closeProductForm);
    document.getElementById("cancel-product-secondary")?.addEventListener("click", closeProductForm);
    document.getElementById("product-form")?.addEventListener("submit", saveProduct);
    document.querySelectorAll("[data-product-view]").forEach((button) => button.addEventListener("click", () => { state.openProductId = state.openProductId === button.dataset.productView ? "" : button.dataset.productView; render(); }));
    document.querySelectorAll("[data-product-edit]").forEach((button) => button.addEventListener("click", () => { const product = state.products.find((item) => item.id === button.dataset.productEdit); if (!product) return; state.productMode = "edit"; state.productDraft = productToDraft(product); state.productErrors = {}; state.openProductId = product.id; state.flash = ""; render(); }));
    document.querySelectorAll("[data-product-archive]").forEach((button) => button.addEventListener("click", () => archiveProduct(button.dataset.productArchive)));
  }

  function bindContactEvents() {
    document.getElementById("contact-search")?.addEventListener("input", (event) => { state.contactSearch = event.target.value; render(); });
    document.getElementById("contact-category-filter")?.addEventListener("change", (event) => { state.contactCategoryFilter = event.target.value; render(); });
    document.getElementById("contact-status-filter")?.addEventListener("change", (event) => { state.contactStatusFilter = event.target.value; render(); });
    document.getElementById("create-contact")?.addEventListener("click", () => { state.contactMode = "create"; state.contactDraft = defaultContactDraft(); state.contactErrors = {}; state.flash = ""; render(); });
    document.getElementById("cancel-contact")?.addEventListener("click", closeContactForm);
    document.getElementById("cancel-contact-secondary")?.addEventListener("click", closeContactForm);
    document.getElementById("contact-form")?.addEventListener("submit", saveContact);
    document.querySelectorAll("[data-contact-view]").forEach((button) => button.addEventListener("click", () => { state.openContactId = state.openContactId === button.dataset.contactView ? "" : button.dataset.contactView; render(); }));
    document.querySelectorAll("[data-contact-edit]").forEach((button) => button.addEventListener("click", () => { const contact = state.contacts.find((item) => item.id === button.dataset.contactEdit); if (!contact) return; state.contactMode = "edit"; state.contactDraft = contactToDraft(contact); state.contactErrors = {}; state.openContactId = contact.id; state.flash = ""; render(); }));
    document.querySelectorAll("[data-contact-archive]").forEach((button) => button.addEventListener("click", () => archiveContact(button.dataset.contactArchive)));
  }

  function closeProductForm() { state.productMode = "idle"; state.productDraft = null; state.productErrors = {}; render(); }
  function closeContactForm() { state.contactMode = "idle"; state.contactDraft = null; state.contactErrors = {}; render(); }

  async function saveProduct(event) {
    event.preventDefault();
    const product = readProductForm(event.currentTarget);
    const errors = validateProductDraft(product);
    if (Object.keys(errors).length > 0) { state.productDraft = product; state.productErrors = errors; render(); return; }
    const isEdit = state.productMode === "edit" && state.productDraft && state.productDraft.id;
    const url = isEdit ? `/api/products/${encodeURIComponent(state.productDraft.id)}` : "/api/products";
    const method = isEdit ? "PUT" : "POST";
    try {
      const result = await requestJSON(url, { method, body: JSON.stringify(product) });
      state.products = result.products || state.products;
      state.productMode = "idle";
      state.productDraft = null;
      state.productErrors = {};
      state.openProductId = result.product ? result.product.id : state.openProductId;
      state.flash = result.message;
      render();
    } catch (error) {
      state.productErrors = error.details || {};
      state.flash = error.message || "Product record could not be saved.";
      render();
    }
  }

  async function archiveProduct(id) {
    if (!window.confirm("Archive this product record?")) return;
    try {
      const result = await requestJSON(`/api/products/${encodeURIComponent(id)}/archive`, { method: "POST" });
      state.products = result.products || state.products;
      state.flash = result.message;
      render();
    } catch (error) {
      state.flash = error.message || "Product record could not be archived.";
      render();
    }
  }

  async function saveContact(event) {
    event.preventDefault();
    const contact = readContactForm(event.currentTarget);
    const errors = validateContactDraft(contact);
    if (Object.keys(errors).length > 0) { state.contactDraft = contact; state.contactErrors = errors; render(); return; }
    const isEdit = state.contactMode === "edit" && state.contactDraft && state.contactDraft.id;
    const url = isEdit ? `/api/contacts/${encodeURIComponent(state.contactDraft.id)}` : "/api/contacts";
    const method = isEdit ? "PUT" : "POST";
    try {
      const result = await requestJSON(url, { method, body: JSON.stringify(contact) });
      state.contacts = result.contacts || state.contacts;
      state.contactMode = "idle";
      state.contactDraft = null;
      state.contactErrors = {};
      state.openContactId = result.contact ? result.contact.id : state.openContactId;
      state.flash = result.message;
      render();
    } catch (error) {
      state.contactErrors = error.details || {};
      state.flash = error.message || "Contact could not be saved.";
      render();
    }
  }

  async function archiveContact(id) {
    if (!window.confirm("Archive this contact?")) return;
    try {
      const result = await requestJSON(`/api/contacts/${encodeURIComponent(id)}/archive`, { method: "POST" });
      state.contacts = result.contacts || state.contacts;
      state.flash = result.message;
      render();
    } catch (error) {
      state.flash = error.message || "Contact could not be archived.";
      render();
    }
  }

  function readProductForm(form) {
    const formData = new FormData(form);
    return {
      productName: clean(formData.get("productName")), category: clean(formData.get("category")), description: clean(formData.get("description")), currentStatus: clean(formData.get("currentStatus")), developmentStage: clean(formData.get("developmentStage")), launchReadiness: clean(formData.get("launchReadiness")), targetUsers: clean(formData.get("targetUsers")), pricingNotes: clean(formData.get("pricingNotes")), revenueNotes: clean(formData.get("revenueNotes")), keyFeatures: linesToArray(formData.get("keyFeatures")), pendingWork: linesToArray(formData.get("pendingWork")), risks: linesToArray(formData.get("risks")), nextMilestone: clean(formData.get("nextMilestone")), responsiblePerson: clean(formData.get("responsiblePerson")),
    };
  }

  function validateProductDraft(product) {
    const errors = {};
    const readiness = Number(product.launchReadiness);
    if (!product.productName) errors.productName = "Product name is required.";
    if (!product.category) errors.category = "Category is required.";
    if (!product.currentStatus) errors.currentStatus = "Status is required.";
    if (!product.developmentStage) errors.developmentStage = "Development stage is required.";
    if (product.launchReadiness === "" || !Number.isFinite(readiness) || readiness < 0 || readiness > 100) errors.launchReadiness = "Launch readiness must be between 0 and 100.";
    if (isActiveProductStatus(product.currentStatus) && !product.responsiblePerson) errors.responsiblePerson = "Responsible person is required if product is active.";
    return errors;
  }

  function defaultProductDraft() {
    return { productName: "", category: "", description: "", currentStatus: state.productStatuses[0] || "Idea", developmentStage: state.productStages[0] || "Discovery", launchReadiness: "0", targetUsers: "", pricingNotes: "", revenueNotes: "", keyFeatures: [], pendingWork: [], risks: [], nextMilestone: "", responsiblePerson: "" };
  }

  function productToDraft(product) {
    return { id: product.id, productName: valueString(product.productName), category: valueString(product.category), description: valueString(product.description), currentStatus: valueString(product.currentStatus), developmentStage: valueString(product.developmentStage), launchReadiness: valueString(product.launchReadiness), targetUsers: valueString(product.targetUsers), pricingNotes: valueString(product.pricingNotes), revenueNotes: valueString(product.revenueNotes), keyFeatures: product.keyFeatures || [], pendingWork: product.pendingWork || [], risks: product.risks || [], nextMilestone: valueString(product.nextMilestone), responsiblePerson: valueString(product.responsiblePerson) };
  }

  function readContactForm(form) {
    const formData = new FormData(form);
    return {
      name: clean(formData.get("name")), organization: clean(formData.get("organization")), role: clean(formData.get("role")), category: clean(formData.get("category")), phone: clean(formData.get("phone")), email: clean(formData.get("email")), notes: clean(formData.get("notes")), relatedDocuments: linesToArray(formData.get("relatedDocuments")), relatedTasks: linesToArray(formData.get("relatedTasks")), lastContactedDate: clean(formData.get("lastContactedDate")), nextFollowUpDate: clean(formData.get("nextFollowUpDate")), status: clean(formData.get("status")),
    };
  }

  function validateContactDraft(contact) {
    const errors = {};
    if (!contact.name) errors.name = "Name is required.";
    if (!contact.category) errors.category = "Category is required.";
    if (!contact.status) errors.status = "Status is required.";
    if (!contact.phone && !contact.email) errors.contactMethod = "Enter at least one contact method: phone or email.";
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errors.email = "Enter a valid email address.";
    if (contact.status === "Follow-up Needed" && !contact.nextFollowUpDate) errors.nextFollowUpDate = "Next follow-up date is required when status is Follow-up Needed.";
    if (contact.lastContactedDate && !/^\d{4}-\d{2}-\d{2}$/.test(contact.lastContactedDate)) errors.lastContactedDate = "Enter a valid last contacted date.";
    if (contact.nextFollowUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(contact.nextFollowUpDate)) errors.nextFollowUpDate = "Enter a valid next follow-up date.";
    return errors;
  }

  function defaultContactDraft() {
    return { name: "", organization: "", role: "", category: "", phone: "", email: "", notes: "", relatedDocuments: [], relatedTasks: [], lastContactedDate: "", nextFollowUpDate: "", status: state.contactStatuses[0] || "Active" };
  }

  function contactToDraft(contact) {
    return { id: contact.id, name: valueString(contact.name), organization: valueString(contact.organization), role: valueString(contact.role), category: valueString(contact.category), phone: valueString(contact.phone), email: valueString(contact.email), notes: valueString(contact.notes), relatedDocuments: contact.relatedDocuments || [], relatedTasks: contact.relatedTasks || [], lastContactedDate: valueString(contact.lastContactedDate), nextFollowUpDate: valueString(contact.nextFollowUpDate), status: valueString(contact.status) };
  }

  function getFilteredProducts() {
    const search = state.productSearch.trim().toLowerCase();
    return state.products.filter((product) => {
      const statusMatch = state.productStatusFilter === "all" || product.currentStatus === state.productStatusFilter;
      const stageMatch = state.productStageFilter === "all" || product.developmentStage === state.productStageFilter;
      const text = [product.productName, product.category, product.currentStatus, product.developmentStage, product.description, product.targetUsers, product.pricingNotes, product.revenueNotes, product.nextMilestone, product.responsiblePerson, ...(product.keyFeatures || []), ...(product.pendingWork || []), ...(product.risks || [])].join(" ").toLowerCase();
      return statusMatch && stageMatch && (!search || text.includes(search));
    }).sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived)) || String(b.lastUpdated || b.createdAt || "").localeCompare(String(a.lastUpdated || a.createdAt || "")));
  }

  function getFilteredContacts() {
    const search = state.contactSearch.trim().toLowerCase();
    return state.contacts.filter((contact) => {
      const categoryMatch = state.contactCategoryFilter === "all" || contact.category === state.contactCategoryFilter;
      const statusMatch = state.contactStatusFilter === "all" || contact.status === state.contactStatusFilter;
      const text = [contact.name, contact.organization, contact.role, contact.category, contact.phone, contact.email, contact.status, contact.notes, ...(contact.relatedDocuments || []), ...(contact.relatedTasks || [])].join(" ").toLowerCase();
      return categoryMatch && statusMatch && (!search || text.includes(search));
    }).sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived)) || String(a.nextFollowUpDate || "9999-12-31").localeCompare(String(b.nextFollowUpDate || "9999-12-31")) || String(a.name || "").localeCompare(String(b.name || "")));
  }

  function renderReadinessIndicator(value) {
    const number = Math.max(0, Math.min(100, Number(value || 0)));
    const tone = number >= 90 ? " is-success" : number >= 60 ? " is-warning" : "";
    return `<div class="readiness-meter" aria-label="Launch readiness ${number}%"><div class="readiness-meter-head"><span>Launch readiness</span><strong>${escapeHTML(String(number))}%</strong></div><div class="readiness-track"><span class="readiness-fill${tone}" style="width: ${number}%"></span></div></div>`;
  }

  function renderContactMethods(contact) {
    const values = [contact.phone, contact.email].filter(Boolean);
    return values.length > 0 ? values.map((value) => escapeHTML(value)).join("<br>") : `<span class="empty-value">${EMPTY_TEXT}</span>`;
  }

  function renderFollowUpIndicator(contact) {
    if (!isActiveContact(contact) || !contact.nextFollowUpDate) return "";
    const days = daysUntil(contact.nextFollowUpDate);
    if (days === null) return "";
    if (days < 0) return `<span class="status-pill is-error due-indicator">Follow-up overdue</span>`;
    if (days <= DUE_SOON_DAYS) return `<span class="status-pill is-warning due-indicator">Follow-up due</span>`;
    return "";
  }

  function isActiveProduct(product) {
    return !product.archived && isActiveProductStatus(product.currentStatus);
  }

  function isActiveProductStatus(status) {
    return Boolean(status) && !PRODUCT_CLOSED_STATUSES.has(status);
  }

  function isActiveContact(contact) {
    return !contact.archived && !CONTACT_CLOSED_STATUSES.has(contact.status);
  }

  function isFollowUpDue(contact) {
    if (!isActiveContact(contact) || !contact.nextFollowUpDate) return false;
    const days = daysUntil(contact.nextFollowUpDate);
    return days !== null && days <= 0;
  }

  function renderEcosystemControlPlane() {
    const canManage = state.permissions.canManageEcosystem;
    const canUpdate = state.permissions.canUpdateEcosystemStatus;
    const canDelete = state.permissions.canDeleteEcosystemProducts;
    const products = getFilteredEcosystemProducts();
    return `
      <section class="portal-section" id="ecosystem-control-plane" data-section="ecosystem-control-plane">
        ${sectionHeader("09", "Ecosystem Control Plane", "Registry, health, revenue visibility, compliance, deployment, ownership, roadmap, launch, and risk tracking across KRAVIA products.", canManage ? `<button class="secondary-button" type="button" id="create-ecosystem-product">${icons.plus}<span>Add product</span></button>` : canUpdate ? `<span class="access-note">Status update access</span>` : `<span class="access-note">Read-only access</span>`)}
        ${renderEcosystemDashboard()}
        <div class="vault-controls ecosystem-controls">
          <label class="visually-hidden" for="ecosystem-search">Search ecosystem products</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="ecosystem-search" type="search" autocomplete="off" value="${escapeAttribute(state.ecosystemSearch)}" placeholder="Search ecosystem products"></div>
          <select id="ecosystem-status-filter" class="select-control" aria-label="Filter ecosystem products by status"><option value="all"${state.ecosystemStatusFilter === "all" ? " selected" : ""}>All statuses</option>${state.ecosystemStatusOptions.map((status) => `<option value="${escapeAttribute(status)}"${state.ecosystemStatusFilter === status ? " selected" : ""}>${escapeHTML(formatEnumLabel(status))}</option>`).join("")}</select>
          <select id="ecosystem-owner-filter" class="select-control" aria-label="Filter ecosystem products by owner"><option value="all"${state.ecosystemOwnerFilter === "all" ? " selected" : ""}>All owners</option>${getEcosystemOwners().map((owner) => `<option value="${escapeAttribute(owner)}"${state.ecosystemOwnerFilter === owner ? " selected" : ""}>${escapeHTML(owner)}</option>`).join("")}</select>
        </div>
        ${state.ecosystemMode !== "idle" ? renderEcosystemProductForm() : ""}
        ${renderEcosystemRegistry(products, canManage, canUpdate, canDelete)}
        ${renderOpenEcosystemProductDetail(products, canManage, canUpdate, canDelete)}
        <div class="ecosystem-module-grid">
          ${renderEcosystemHealthModule()}
          ${renderEcosystemRevenueModule()}
          ${renderEcosystemRoadmapModule()}
          ${renderEcosystemLaunchChecklistModule()}
          ${renderEcosystemRiskRegisterModule()}
          ${renderEcosystemReportModule()}
        </div>
      </section>`;
  }

  function renderEcosystemDashboard() {
    const summary = getEcosystemSummary();
    return `<div class="summary-grid ecosystem-dashboard" aria-label="Ecosystem dashboard">
      ${renderSummaryCard("Registered products", summary.registeredProducts)}
      ${renderSummaryCard("Product health readiness", summary.healthReadiness)}
      ${renderSummaryCard("Launch readiness", summary.launchReadiness)}
      ${renderSummaryCard("Revenue visibility", summary.revenueVisibility)}
      ${renderSummaryCard("Compliance visibility", summary.complianceVisibility)}
      ${renderSummaryCard("Security visibility", summary.securityVisibility)}
      ${renderSummaryCard("Remaining ecosystem gaps", summary.remainingGaps, summary.remainingGaps > 0 ? "warning" : "")}
      ${renderSummaryCard("Persistence", state.ecosystemPersistence)}
    </div>`;
  }

  function renderEcosystemRegistry(products, canManage, canUpdate, canDelete) {
    return `<div class="panel ecosystem-registry-panel"><div class="panel-heading"><div><h3>Product Registry</h3><p>Controlled system of record for product identity, ownership, status, URLs, version, and launch posture.</p></div></div>${products.length > 0 ? `<div class="table-scroll"><table class="ecosystem-table"><thead><tr><th scope="col">Product</th><th scope="col">Code</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Version</th><th scope="col">Deployment</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead><tbody>${products.map((product) => `<tr><td><strong>${escapeHTML(product.productName)}</strong><span>${renderDisplayValue(product.domain)}</span></td><td>${escapeHTML(product.productCode)}</td><td>${renderStatusValue(formatEnumLabel(product.status))}</td><td>${renderDisplayValue(product.owner)}</td><td>${renderDisplayValue(product.currentVersion)}</td><td>${renderStatusValue(formatEnumLabel(product.deploymentStatus))}</td><td>${renderDisplayValue(formatDateTimeValue(product.lastUpdated))}</td><td><div class="table-actions"><button class="icon-button compact" type="button" data-ecosystem-view="${escapeAttribute(product.id)}" aria-label="View ecosystem product">${icons.view}</button>${canUpdate ? `<button class="icon-button compact" type="button" data-ecosystem-status="${escapeAttribute(product.id)}" aria-label="Update ecosystem product status">${icons.check}</button>` : ""}${canManage ? `<button class="icon-button compact" type="button" data-ecosystem-edit="${escapeAttribute(product.id)}" aria-label="Edit ecosystem product">${icons.edit}</button>` : ""}${canDelete && product.status !== "ARCHIVED" ? `<button class="icon-button compact" type="button" data-ecosystem-delete="${escapeAttribute(product.id)}" aria-label="Archive ecosystem product">${icons.archive}</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>` : renderEmptyBlock("Product Registry", EMPTY_ECOSYSTEM_TEXT)}</div>`;
  }

  function renderOpenEcosystemProductDetail(products, canManage, canUpdate, canDelete) {
    const product = products.find((item) => item.id === state.openEcosystemId);
    if (!product) return "";
    return `<article class="record-card printable-record ecosystem-detail-card"><div class="record-card-header"><div><p class="overline">${escapeHTML(product.productCode)}</p><h3>${escapeHTML(product.productName)}</h3><p>${renderStatusValue(formatEnumLabel(product.status))} ${renderStatusValue(formatEnumLabel(product.launchStatus))}</p></div><div class="record-actions">${canUpdate ? `<button class="secondary-button" type="button" data-ecosystem-status="${escapeAttribute(product.id)}">${icons.check}<span>Update status</span></button>` : ""}${canManage ? `<button class="secondary-button" type="button" data-ecosystem-edit="${escapeAttribute(product.id)}">${icons.edit}<span>Edit</span></button>` : ""}${canDelete && product.status !== "ARCHIVED" ? `<button class="secondary-button" type="button" data-ecosystem-delete="${escapeAttribute(product.id)}">${icons.archive}<span>Archive</span></button>` : ""}</div></div>${renderEcosystemReadinessIndicator("Product health readiness", getEcosystemReadiness(product))}${renderRecordDetails([["Description", product.description], ["Owner", product.owner], ["Domain", product.domain], ["Backend URL", product.backendUrl], ["Frontend URL", product.frontendUrl], ["Current version", product.currentVersion], ["Revenue status", formatEnumLabel(product.revenueStatus)], ["Compliance status", formatEnumLabel(product.complianceStatus)], ["Security status", formatEnumLabel(product.securityStatus)], ["Deployment status", formatEnumLabel(product.deploymentStatus)], ["Roadmap", product.roadmapItems], ["Launch checklist", product.launchChecklist], ["Risks", product.risks], ["Remaining gaps", getEcosystemGaps(product)], ["Created by", product.createdBy], ["Last updated", formatDateTimeValue(product.lastUpdated)]])}</article>`;
  }

  function renderEcosystemProductForm() {
    const draft = state.ecosystemDraft;
    const errors = state.ecosystemErrors;
    const statusOnly = state.ecosystemMode === "status";
    const title = statusOnly ? "Update product status" : state.ecosystemMode === "edit" ? "Edit ecosystem product" : "Add ecosystem product";
    return `<form class="panel enterprise-form record-form ecosystem-form" id="ecosystem-form" novalidate><div class="panel-heading"><div><h3>${escapeHTML(title)}</h3><p>${statusOnly ? "Directors can update status visibility without changing product identity or ownership." : "Register a KRAVIA product without fake metrics, revenue, uptime, or launch data."}</p></div><button class="icon-button" type="button" id="cancel-ecosystem" aria-label="Cancel ecosystem form">${icons.close}</button></div><div class="form-grid">${!statusOnly ? textInput("productName", "Product name", draft.productName, errors.productName, { required: true }) : ""}${!statusOnly ? textInput("productCode", "Product code", draft.productCode, errors.productCode, { required: true }) : ""}${selectInput("status", "Status", draft.status, state.ecosystemStatusOptions.map((status) => ({ value: status, label: formatEnumLabel(status) })), errors.status, { required: true, placeholder: "Select status" })}${!statusOnly ? textInput("owner", "Owner", draft.owner, errors.owner) : ""}${!statusOnly ? textInput("domain", "Domain", draft.domain, errors.domain) : ""}${!statusOnly ? textInput("backendUrl", "Backend URL", draft.backendUrl, errors.backendUrl, { type: "url" }) : ""}${!statusOnly ? textInput("frontendUrl", "Frontend URL", draft.frontendUrl, errors.frontendUrl, { type: "url" }) : ""}${!statusOnly ? textInput("currentVersion", "Current version", draft.currentVersion, errors.currentVersion) : ""}${selectInput("launchStatus", "Launch status", draft.launchStatus, state.ecosystemLaunchStatusOptions.map((status) => ({ value: status, label: formatEnumLabel(status) })), errors.launchStatus, { placeholder: "Not added" })}${selectInput("revenueStatus", "Revenue status", draft.revenueStatus, state.ecosystemRevenueStatusOptions.map((status) => ({ value: status, label: formatEnumLabel(status) })), errors.revenueStatus, { placeholder: "Not added" })}${selectInput("complianceStatus", "Compliance status", draft.complianceStatus, state.ecosystemComplianceStatusOptions.map((status) => ({ value: status, label: formatEnumLabel(status) })), errors.complianceStatus, { placeholder: "Not added" })}${selectInput("securityStatus", "Security status", draft.securityStatus, state.ecosystemSecurityStatusOptions.map((status) => ({ value: status, label: formatEnumLabel(status) })), errors.securityStatus, { placeholder: "Not added" })}${selectInput("deploymentStatus", "Deployment status", draft.deploymentStatus, state.ecosystemDeploymentStatusOptions.map((status) => ({ value: status, label: formatEnumLabel(status) })), errors.deploymentStatus, { placeholder: "Not added" })}${!statusOnly ? textareaInput("description", "Description", draft.description, errors.description) : ""}${!statusOnly ? textareaInput("roadmapItems", "Roadmap items", arrayToLines(draft.roadmapItems), errors.roadmapItems, "Enter one roadmap item per line.") : ""}${!statusOnly ? textareaInput("launchChecklist", "Launch checklist", arrayToLines(draft.launchChecklist), errors.launchChecklist, "Enter one checklist item per line.") : ""}${!statusOnly ? textareaInput("risks", "Risks", arrayToLines(draft.risks), errors.risks, "Enter one risk per line.") : ""}</div><div class="form-actions"><button class="primary-button" type="submit">${icons.save}<span>Save product</span></button><button class="secondary-button" type="button" id="cancel-ecosystem-secondary">Cancel</button></div></form>`;
  }

  function renderEcosystemHealthModule() { const products = state.ecosystemProducts; return `<section class="panel ecosystem-module"><div class="panel-heading"><div><h3>Product Health</h3><p>Readiness is derived only from recorded product fields. No fake uptime is generated.</p></div></div>${products.length > 0 ? `<div class="ecosystem-mini-list">${products.map((product) => `<article>${renderEcosystemReadinessIndicator(product.productName, getEcosystemReadiness(product))}<p>${renderStatusValue(formatEnumLabel(product.securityStatus))} ${renderStatusValue(formatEnumLabel(product.complianceStatus))}</p></article>`).join("")}</div>` : renderEmptyBlock("Product Health", EMPTY_ECOSYSTEM_TEXT)}</section>`; }
  function renderEcosystemRevenueModule() { const products = state.ecosystemProducts; return `<section class="panel ecosystem-module"><div class="panel-heading"><div><h3>Product Revenue Summary</h3><p>Status-only revenue visibility. No dummy revenue values are generated.</p></div></div>${products.length > 0 ? `<div class="table-scroll"><table class="ecosystem-compact-table"><thead><tr><th>Product</th><th>Revenue status</th><th>Launch status</th></tr></thead><tbody>${products.map((product) => `<tr><td>${escapeHTML(product.productName)}</td><td>${renderStatusValue(formatEnumLabel(product.revenueStatus))}</td><td>${renderStatusValue(formatEnumLabel(product.launchStatus))}</td></tr>`).join("")}</tbody></table></div>` : renderEmptyBlock("Product Revenue Summary", EMPTY_ECOSYSTEM_TEXT)}</section>`; }
  function renderEcosystemRoadmapModule() { const items = state.ecosystemProducts.flatMap((product) => (product.roadmapItems || []).map((item) => ({ product: product.productName, item }))); return `<section class="panel ecosystem-module"><div class="panel-heading"><div><h3>Product Roadmap</h3></div></div>${items.length > 0 ? `<ul class="ecosystem-list">${items.map((entry) => `<li><span>${escapeHTML(entry.product)}</span><strong>${escapeHTML(entry.item)}</strong></li>`).join("")}</ul>` : renderEmptyBlock("Product Roadmap", EMPTY_TEXT)}</section>`; }
  function renderEcosystemLaunchChecklistModule() { const items = state.ecosystemProducts.flatMap((product) => (product.launchChecklist || []).map((item) => ({ product: product.productName, item }))); return `<section class="panel ecosystem-module"><div class="panel-heading"><div><h3>Product Launch Checklist</h3></div></div>${items.length > 0 ? `<ul class="ecosystem-list">${items.map((entry) => `<li><span>${escapeHTML(entry.product)}</span><strong>${escapeHTML(entry.item)}</strong></li>`).join("")}</ul>` : renderEmptyBlock("Product Launch Checklist", EMPTY_TEXT)}</section>`; }
  function renderEcosystemRiskRegisterModule() { const risks = state.ecosystemProducts.flatMap((product) => (product.risks || []).map((risk) => ({ product: product.productName, risk }))); return `<section class="panel ecosystem-module"><div class="panel-heading"><div><h3>Product Risk Register</h3></div></div>${risks.length > 0 ? `<ul class="ecosystem-list risk-list">${risks.map((entry) => `<li><span>${escapeHTML(entry.product)}</span><strong>${escapeHTML(entry.risk)}</strong></li>`).join("")}</ul>` : renderEmptyBlock("Product Risk Register", EMPTY_TEXT)}</section>`; }
  function renderEcosystemReportModule() { const summary = getEcosystemSummary(); return `<section class="panel ecosystem-module ecosystem-report printable-record"><div class="panel-heading"><div><h3>Ecosystem Control Plane Report</h3><p>Export-ready overview for registered products, readiness, visibility, and gaps.</p></div></div>${renderRecordDetails([["Registered products", summary.registeredProducts], ["Product health readiness", summary.healthReadiness], ["Launch readiness", summary.launchReadiness], ["Revenue visibility", summary.revenueVisibility], ["Compliance visibility", summary.complianceVisibility], ["Security visibility", summary.securityVisibility], ["Remaining ecosystem gaps", summary.remainingGaps]])}</section>`; }

  function bindEcosystemEvents() {
    document.getElementById("ecosystem-search")?.addEventListener("input", (event) => { state.ecosystemSearch = event.target.value; render(); });
    document.getElementById("ecosystem-status-filter")?.addEventListener("change", (event) => { state.ecosystemStatusFilter = event.target.value; render(); });
    document.getElementById("ecosystem-owner-filter")?.addEventListener("change", (event) => { state.ecosystemOwnerFilter = event.target.value; render(); });
    document.getElementById("create-ecosystem-product")?.addEventListener("click", () => { state.ecosystemMode = "create"; state.ecosystemDraft = defaultEcosystemDraft(); state.ecosystemErrors = {}; state.flash = ""; render(); });
    document.getElementById("cancel-ecosystem")?.addEventListener("click", closeEcosystemForm);
    document.getElementById("cancel-ecosystem-secondary")?.addEventListener("click", closeEcosystemForm);
    document.getElementById("ecosystem-form")?.addEventListener("submit", saveEcosystemProduct);
    document.querySelectorAll("[data-ecosystem-view]").forEach((button) => button.addEventListener("click", () => { state.openEcosystemId = state.openEcosystemId === button.dataset.ecosystemView ? "" : button.dataset.ecosystemView; render(); }));
    document.querySelectorAll("[data-ecosystem-edit]").forEach((button) => button.addEventListener("click", () => { const product = state.ecosystemProducts.find((item) => item.id === button.dataset.ecosystemEdit); if (!product) return; state.ecosystemMode = "edit"; state.ecosystemDraft = ecosystemToDraft(product); state.ecosystemErrors = {}; state.openEcosystemId = product.id; state.flash = ""; render(); }));
    document.querySelectorAll("[data-ecosystem-status]").forEach((button) => button.addEventListener("click", () => { const product = state.ecosystemProducts.find((item) => item.id === button.dataset.ecosystemStatus); if (!product) return; state.ecosystemMode = "status"; state.ecosystemDraft = ecosystemToDraft(product); state.ecosystemErrors = {}; state.openEcosystemId = product.id; state.flash = ""; render(); }));
    document.querySelectorAll("[data-ecosystem-delete]").forEach((button) => button.addEventListener("click", () => archiveEcosystemProduct(button.dataset.ecosystemDelete)));
  }

  function closeEcosystemForm() { state.ecosystemMode = "idle"; state.ecosystemDraft = null; state.ecosystemErrors = {}; render(); }

  async function saveEcosystemProduct(event) {
    event.preventDefault();
    const statusOnly = state.ecosystemMode === "status";
    const product = readEcosystemForm(event.currentTarget, statusOnly);
    const errors = validateEcosystemDraft(product, statusOnly);
    if (Object.keys(errors).length > 0) { state.ecosystemDraft = { ...state.ecosystemDraft, ...product }; state.ecosystemErrors = errors; render(); return; }
    const isEdit = state.ecosystemMode === "edit" || state.ecosystemMode === "status";
    const url = isEdit ? `/api/ecosystem/products/${encodeURIComponent(state.ecosystemDraft.id)}` : "/api/ecosystem/products";
    const method = isEdit ? "PUT" : "POST";
    try {
      const result = await requestJSON(url, { method, body: JSON.stringify(product) });
      state.ecosystemProducts = result.products || state.ecosystemProducts;
      state.auditLogs = result.auditLogs || state.auditLogs;
      state.ecosystemPersistence = result.persistence || state.ecosystemPersistence;
      state.ecosystemMode = "idle";
      state.ecosystemDraft = null;
      state.ecosystemErrors = {};
      state.openEcosystemId = result.product ? result.product.id : state.openEcosystemId;
      state.flash = result.message;
      render();
    } catch (error) {
      state.ecosystemErrors = error.details || {};
      state.flash = error.message || "Ecosystem product could not be saved.";
      render();
    }
  }

  async function archiveEcosystemProduct(id) {
    if (!window.confirm("Archive this ecosystem product?")) return;
    try {
      const result = await requestJSON(`/api/ecosystem/products/${encodeURIComponent(id)}`, { method: "DELETE" });
      state.ecosystemProducts = result.products || state.ecosystemProducts;
      state.auditLogs = result.auditLogs || state.auditLogs;
      state.flash = result.message;
      render();
    } catch (error) {
      state.flash = error.message || "Ecosystem product could not be archived.";
      render();
    }
  }

  function readEcosystemForm(form, statusOnly) {
    const formData = new FormData(form);
    const statuses = { status: clean(formData.get("status")), launchStatus: clean(formData.get("launchStatus")), revenueStatus: clean(formData.get("revenueStatus")), complianceStatus: clean(formData.get("complianceStatus")), securityStatus: clean(formData.get("securityStatus")), deploymentStatus: clean(formData.get("deploymentStatus")) };
    if (statusOnly) return statuses;
    return { productName: clean(formData.get("productName")), productCode: clean(formData.get("productCode")), ...statuses, owner: clean(formData.get("owner")), description: clean(formData.get("description")), domain: clean(formData.get("domain")), backendUrl: clean(formData.get("backendUrl")), frontendUrl: clean(formData.get("frontendUrl")), currentVersion: clean(formData.get("currentVersion")), roadmapItems: linesToArray(formData.get("roadmapItems")), launchChecklist: linesToArray(formData.get("launchChecklist")), risks: linesToArray(formData.get("risks")) };
  }

  function validateEcosystemDraft(product, statusOnly) {
    const errors = {};
    if (!product.status) errors.status = "Status is required.";
    if (!statusOnly) {
      if (!product.productName) errors.productName = "Product name is required.";
      if (!product.productCode) errors.productCode = "Product code is required.";
      if (product.productCode && !/^[A-Za-z0-9_-]{2,32}$/.test(product.productCode)) errors.productCode = "Use 2-32 letters, numbers, hyphens, or underscores.";
      if (!["IDEA", "ARCHIVED"].includes(product.status) && !product.owner) errors.owner = "Owner is required unless the product is only an idea or archived.";
      if (product.backendUrl && !isValidHttpUrl(product.backendUrl)) errors.backendUrl = "Enter a valid backend URL.";
      if (product.frontendUrl && !isValidHttpUrl(product.frontendUrl)) errors.frontendUrl = "Enter a valid frontend URL.";
    }
    return errors;
  }

  function defaultEcosystemDraft() { return { productName: "", productCode: "", status: "", owner: "", description: "", domain: "", backendUrl: "", frontendUrl: "", currentVersion: "", launchStatus: "", revenueStatus: "", complianceStatus: "", securityStatus: "", deploymentStatus: "", roadmapItems: [], launchChecklist: [], risks: [] }; }
  function ecosystemToDraft(product) { return { id: product.id, productName: valueString(product.productName), productCode: valueString(product.productCode), status: valueString(product.status), owner: valueString(product.owner), description: valueString(product.description), domain: valueString(product.domain), backendUrl: valueString(product.backendUrl), frontendUrl: valueString(product.frontendUrl), currentVersion: valueString(product.currentVersion), launchStatus: valueString(product.launchStatus), revenueStatus: valueString(product.revenueStatus), complianceStatus: valueString(product.complianceStatus), securityStatus: valueString(product.securityStatus), deploymentStatus: valueString(product.deploymentStatus), roadmapItems: product.roadmapItems || [], launchChecklist: product.launchChecklist || [], risks: product.risks || [] }; }

  function getFilteredEcosystemProducts() {
    const search = state.ecosystemSearch.trim().toLowerCase();
    return state.ecosystemProducts.filter((product) => {
      const statusMatch = state.ecosystemStatusFilter === "all" || product.status === state.ecosystemStatusFilter;
      const ownerMatch = state.ecosystemOwnerFilter === "all" || product.owner === state.ecosystemOwnerFilter;
      const text = [product.productName, product.productCode, product.status, product.owner, product.domain, product.backendUrl, product.frontendUrl, product.currentVersion, product.launchStatus, product.revenueStatus, product.complianceStatus, product.securityStatus, product.deploymentStatus, product.description, ...(product.roadmapItems || []), ...(product.launchChecklist || []), ...(product.risks || [])].join(" ").toLowerCase();
      return statusMatch && ownerMatch && (!search || text.includes(search));
    }).sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived)) || String(b.lastUpdated || b.createdAt || "").localeCompare(String(a.lastUpdated || a.createdAt || "")));
  }

  function getEcosystemOwners() { return [...new Set(state.ecosystemProducts.map((product) => product.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }

  function getEcosystemSummary() {
    const products = state.ecosystemProducts;
    const registeredProducts = products.length;
    const percent = (count) => registeredProducts === 0 ? EMPTY_TEXT : `${Math.round((count / registeredProducts) * 100)}%`;
    return {
      registeredProducts,
      healthReadiness: registeredProducts === 0 ? EMPTY_TEXT : `${Math.round(products.reduce((total, product) => total + getEcosystemReadiness(product), 0) / registeredProducts)}%`,
      launchReadiness: percent(products.filter((product) => product.status === "LAUNCH_READY" || product.launchStatus === "LAUNCH_READY").length),
      revenueVisibility: percent(products.filter((product) => product.revenueStatus).length),
      complianceVisibility: percent(products.filter((product) => product.complianceStatus).length),
      securityVisibility: percent(products.filter((product) => product.securityStatus).length),
      remainingGaps: products.reduce((total, product) => total + getEcosystemGaps(product).length, 0),
    };
  }

  function getEcosystemReadiness(product) { const fields = ["productName", "productCode", "status", "owner", "domain", "backendUrl", "frontendUrl", "currentVersion", "launchStatus", "revenueStatus", "complianceStatus", "securityStatus", "deploymentStatus"]; return Math.round((fields.filter((field) => !isEmpty(product[field])).length / fields.length) * 100); }
  function getEcosystemGaps(product) { const gaps = []; [["owner", "Owner"], ["domain", "Domain"], ["backendUrl", "Backend URL"], ["frontendUrl", "Frontend URL"], ["currentVersion", "Current version"], ["launchStatus", "Launch status"], ["revenueStatus", "Revenue status"], ["complianceStatus", "Compliance status"], ["securityStatus", "Security status"], ["deploymentStatus", "Deployment status"]].forEach(([key, label]) => { if (isEmpty(product[key])) gaps.push(label); }); if (!Array.isArray(product.roadmapItems) || product.roadmapItems.length === 0) gaps.push("Roadmap"); if (!Array.isArray(product.launchChecklist) || product.launchChecklist.length === 0) gaps.push("Launch checklist"); return gaps; }
  function renderEcosystemReadinessIndicator(label, value) { const number = Math.max(0, Math.min(100, Number(value || 0))); const tone = number >= 85 ? " is-success" : number >= 55 ? " is-warning" : ""; return `<div class="readiness-meter ecosystem-readiness" aria-label="${escapeAttribute(label)} ${number}%"><div class="readiness-meter-head"><span>${escapeHTML(label)}</span><strong>${escapeHTML(String(number))}%</strong></div><div class="readiness-track"><span class="readiness-fill${tone}" style="width: ${number}%"></span></div></div>`; }
  function renderAuditActivityLog() {
    const logs = getFilteredAuditLogs();
    return `
      <section class="portal-section" id="audit-activity-log" data-section="audit-activity-log">
        ${sectionHeader("10", "Audit & Activity Log", "Trace important workspace actions by module, user, timestamp, and severity.", `<span class="access-note">${state.permissions.canManageAuditLogs ? "Founder access" : "Read-only access"}</span>`)}
        <div class="vault-controls phase5-controls audit-controls">
          <label class="visually-hidden" for="audit-search">Search activity</label>
          <div class="search-control"><span aria-hidden="true">${icons.search}</span><input id="audit-search" type="search" autocomplete="off" value="${escapeAttribute(state.auditSearch)}" placeholder="Search activity"></div>
          <select id="audit-module-filter" class="select-control" aria-label="Filter activity by module"><option value="all"${state.auditModuleFilter === "all" ? " selected" : ""}>All modules</option>${getAuditModules().map((module) => `<option value="${escapeAttribute(module)}"${state.auditModuleFilter === module ? " selected" : ""}>${escapeHTML(module)}</option>`).join("")}</select>
          <select id="audit-user-filter" class="select-control" aria-label="Filter activity by user"><option value="all"${state.auditUserFilter === "all" ? " selected" : ""}>All users</option>${getAuditUsers().map((user) => `<option value="${escapeAttribute(user)}"${state.auditUserFilter === user ? " selected" : ""}>${escapeHTML(user)}</option>`).join("")}</select>
          <select id="audit-severity-filter" class="select-control" aria-label="Filter activity by severity"><option value="all"${state.auditSeverityFilter === "all" ? " selected" : ""}>All severities</option>${state.auditSeverities.map((severity) => `<option value="${escapeAttribute(severity)}"${state.auditSeverityFilter === severity ? " selected" : ""}>${escapeHTML(severity)}</option>`).join("")}</select>
          <input id="audit-date-from" class="select-control" type="date" value="${escapeAttribute(state.auditDateFrom)}" aria-label="Filter activity from date">
          <input id="audit-date-to" class="select-control" type="date" value="${escapeAttribute(state.auditDateTo)}" aria-label="Filter activity to date">
        </div>
        <div class="panel records-panel">${logs.length > 0 ? renderAuditTimeline(logs) : renderEmptyBlock("Audit & Activity Log", EMPTY_ACTIVITY_TEXT)}</div>
      </section>`;
  }

  function renderAuditTimeline(logs) {
    return `<div class="audit-timeline">${logs.map((log) => {
      const isOpen = state.openAuditId === log.id;
      return `<article class="audit-event printable-record">
        <button class="audit-event-summary" type="button" data-audit-view="${escapeAttribute(log.id)}" aria-expanded="${isOpen}">
          <span class="audit-event-marker" aria-hidden="true"></span>
          <span class="audit-event-copy"><span class="overline">${escapeHTML(formatDateTimeValue(log.timestamp))}</span><strong>${escapeHTML(log.actionType)}</strong><span>${escapeHTML(log.description || log.module)}</span></span>
          <span class="audit-event-meta">${renderStatusValue(log.severity)} <span class="role-badge">${escapeHTML(formatRole(log.role))}</span></span>
        </button>
        ${isOpen ? renderRecordDetails([
          ["Module", log.module], ["User", log.user], ["Role", formatRole(log.role)], ["Date and time", formatDateTimeValue(log.timestamp)],
          ["Previous value placeholder", log.previousValuePlaceholder], ["New value placeholder", log.newValuePlaceholder], ["IP/device placeholder", log.ipDevicePlaceholder], ["Severity", log.severity],
        ]) : ""}
      </article>`;
    }).join("")}</div>`;
  }

  function renderSettingsSection() {
    const settings = state.isEditingSettings ? state.settingsDraft : state.settings;
    const canEdit = state.permissions.canEditSettings;
    return `
      <section class="portal-section" id="workspace-settings" data-section="workspace-settings">
        ${sectionHeader("11", "Settings", "Workspace branding, user visibility, security controls, reminders, backup placeholders, and display preferences.", canEdit && !state.isEditingSettings ? `<button class="secondary-button" type="button" id="edit-settings">${icons.edit}<span>Edit settings</span></button>` : !canEdit ? `<span class="access-note">Limited read-only settings</span>` : "")}
        ${settings ? (state.isEditingSettings ? renderSettingsForm(settings) : renderSettingsDisplay(settings, canEdit)) : `<div class="panel">${renderEmptyBlock("Settings", EMPTY_TEXT)}</div>`}
      </section>`;
  }

  function renderSettingsDisplay(settings, canEdit) {
    return `<div class="settings-grid">
      ${renderSettingsGroup("Company Branding", [
        ["Company display name", settings.branding?.companyDisplayName], ["Company short name", settings.branding?.companyShortName], ["Logo placeholder", settings.branding?.logoPlaceholder], ["Brand color placeholder", settings.branding?.brandColorPlaceholder], ["Footer text", settings.branding?.footerText],
      ])}
      ${renderUsersRolesGroup(canEdit)}
      ${renderSettingsGroup("Security", [
        ["Session timeout", settings.security?.sessionTimeoutMinutes ? `${settings.security.sessionTimeoutMinutes} minutes` : ""], ["Password policy placeholder", settings.security?.passwordPolicyPlaceholder], ["Two-factor authentication placeholder", settings.security?.twoFactorAuthenticationPlaceholder], ["Login history link", "Audit & Activity Log"], ["Protected route status", settings.security?.protectedRouteStatus],
      ])}
      ${renderSettingsGroup("Notifications", [
        ["Compliance reminders", yesNo(settings.notifications?.complianceReminders)], ["Task reminders", yesNo(settings.notifications?.taskReminders)], ["Board meeting reminders", yesNo(settings.notifications?.boardMeetingReminders)], ["Financial monthly review reminders", yesNo(settings.notifications?.financialMonthlyReviewReminders)], ["Email notification placeholder", settings.notifications?.emailNotificationPlaceholder],
      ])}
      ${renderSettingsGroup("Data & Backup", [
        ["Export data placeholder", settings.dataBackup?.exportDataPlaceholder], ["Import data placeholder", settings.dataBackup?.importDataPlaceholder], ["Backup status placeholder", settings.dataBackup?.backupStatusPlaceholder], ["Restore placeholder", settings.dataBackup?.restorePlaceholder], ["Last backup placeholder", settings.dataBackup?.lastBackupPlaceholder],
      ], renderSettingsPlaceholders())}
      ${renderSettingsGroup("Display Preferences", [
        ["Display mode", settings.displayPreferences?.displayMode], ["Compact layout", yesNo(settings.displayPreferences?.compactLayout)], ["Print-friendly mode", yesNo(settings.displayPreferences?.printFriendlyMode)],
      ])}
    </div>`;
  }

  function renderSettingsGroup(title, fields, footer) {
    return `<section class="panel settings-group"><div class="panel-heading"><div><h3>${escapeHTML(title)}</h3></div></div><dl class="settings-list">${fields.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${renderDisplayValue(value)}</dd></div>`).join("")}</dl>${footer || ""}</section>`;
  }

  function renderUsersRolesGroup(canEdit) {
    return `<section class="panel settings-group settings-group-wide"><div class="panel-heading"><div><h3>Users & Roles</h3><p>Users are sourced from the local authentication configuration until a real identity provider is connected.</p></div>${canEdit ? `<button class="secondary-button" type="button" disabled title="Invite user placeholder">${icons.plus}<span>Invite user</span></button>` : ""}</div>${state.settingsUsers.length > 0 ? `<div class="table-scroll"><table class="settings-users-table"><thead><tr><th scope="col">User name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Last active</th><th scope="col">Actions</th></tr></thead><tbody>${state.settingsUsers.map((user) => `<tr><td>${escapeHTML(user.name)}</td><td>${escapeHTML(user.email)}</td><td><span class="role-badge">${escapeHTML(formatRole(user.role))}</span></td><td>${renderStatusValue(user.status)}</td><td>${renderDisplayValue(formatDateTimeValue(user.lastActive))}</td><td><div class="table-actions"><button class="icon-button compact" type="button" disabled title="Change role placeholder">${icons.edit}</button><button class="icon-button compact" type="button" disabled title="Disable user placeholder">${icons.archive}</button></div></td></tr>`).join("")}</tbody></table></div>` : renderEmptyBlock("Users & Roles", EMPTY_TEXT)}</section>`;
  }

  function renderSettingsForm(settings) {
    const errors = state.settingsErrors;
    return `<form class="settings-form" id="settings-form" novalidate>
      <section class="panel settings-group"><div class="panel-heading"><div><h3>Company Branding</h3></div></div><div class="form-grid">
        ${textInput("companyDisplayName", "Company display name", settings.branding?.companyDisplayName, errors.companyDisplayName, { required: true })}
        ${textInput("companyShortName", "Company short name", settings.branding?.companyShortName, errors.companyShortName)}
        ${textInput("logoPlaceholder", "Logo placeholder", settings.branding?.logoPlaceholder, errors.logoPlaceholder)}
        ${textInput("brandColorPlaceholder", "Brand color placeholder", settings.branding?.brandColorPlaceholder, errors.brandColorPlaceholder)}
        ${textareaInput("footerText", "Footer text", settings.branding?.footerText, errors.footerText)}
      </div></section>
      ${renderUsersRolesGroup(true)}
      <section class="panel settings-group"><div class="panel-heading"><div><h3>Security</h3></div></div><div class="form-grid">
        ${textInput("sessionTimeoutMinutes", "Session timeout", settings.security?.sessionTimeoutMinutes, errors.sessionTimeoutMinutes, { type: "number", step: "1", required: true })}
        ${textInput("protectedRouteStatus", "Protected route status", settings.security?.protectedRouteStatus, errors.protectedRouteStatus)}
        ${textareaInput("passwordPolicyPlaceholder", "Password policy placeholder", settings.security?.passwordPolicyPlaceholder, errors.passwordPolicyPlaceholder)}
        ${textareaInput("twoFactorAuthenticationPlaceholder", "Two-factor authentication placeholder", settings.security?.twoFactorAuthenticationPlaceholder, errors.twoFactorAuthenticationPlaceholder)}
      </div></section>
      <section class="panel settings-group"><div class="panel-heading"><div><h3>Notifications</h3></div></div><div class="settings-checkbox-grid">
        ${checkboxInput("complianceReminders", "Compliance reminders", settings.notifications?.complianceReminders)}
        ${checkboxInput("taskReminders", "Task reminders", settings.notifications?.taskReminders)}
        ${checkboxInput("boardMeetingReminders", "Board meeting reminders", settings.notifications?.boardMeetingReminders)}
        ${checkboxInput("financialMonthlyReviewReminders", "Financial monthly review reminders", settings.notifications?.financialMonthlyReviewReminders)}
      </div>${textareaInput("emailNotificationPlaceholder", "Email notification placeholder", settings.notifications?.emailNotificationPlaceholder, errors.emailNotificationPlaceholder)}</section>
      <section class="panel settings-group"><div class="panel-heading"><div><h3>Data & Backup</h3></div></div><div class="form-grid">
        ${textInput("exportDataPlaceholder", "Export data placeholder", settings.dataBackup?.exportDataPlaceholder, errors.exportDataPlaceholder)}
        ${textInput("importDataPlaceholder", "Import data placeholder", settings.dataBackup?.importDataPlaceholder, errors.importDataPlaceholder)}
        ${textInput("backupStatusPlaceholder", "Backup status placeholder", settings.dataBackup?.backupStatusPlaceholder, errors.backupStatusPlaceholder)}
        ${textInput("restorePlaceholder", "Restore placeholder", settings.dataBackup?.restorePlaceholder, errors.restorePlaceholder)}
        ${textInput("lastBackupPlaceholder", "Last backup placeholder", settings.dataBackup?.lastBackupPlaceholder, errors.lastBackupPlaceholder)}
      </div>${renderSettingsPlaceholders()}</section>
      <section class="panel settings-group"><div class="panel-heading"><div><h3>Display Preferences</h3></div></div><div class="form-grid">
        ${selectInput("displayMode", "Display mode", settings.displayPreferences?.displayMode, DISPLAY_MODES.map((mode) => ({ value: mode, label: formatRole(mode) })), errors.displayMode, { required: true })}
      </div><div class="settings-checkbox-grid">
        ${checkboxInput("compactLayout", "Compact layout", settings.displayPreferences?.compactLayout)}
        ${checkboxInput("printFriendlyMode", "Print-friendly mode", settings.displayPreferences?.printFriendlyMode)}
      </div></section>
      <div class="form-actions settings-actions"><button class="primary-button" type="submit" ${state.isSavingSettings ? "disabled" : ""}>${icons.save}<span>${state.isSavingSettings ? "Saving" : "Save settings"}</span></button><button class="secondary-button" type="button" id="cancel-settings" ${state.isSavingSettings ? "disabled" : ""}>${icons.close}<span>Cancel</span></button></div>
    </form>`;
  }

  function renderSettingsPlaceholders() {
    return `<div class="settings-placeholder-actions"><button class="secondary-button" type="button" disabled>Export data</button><button class="secondary-button" type="button" disabled>Import data</button><button class="secondary-button" type="button" disabled>Restore</button></div>`;
  }

  function bindAuditEvents() {
    document.getElementById("audit-search")?.addEventListener("input", (event) => { state.auditSearch = event.target.value; render(); });
    document.getElementById("audit-module-filter")?.addEventListener("change", (event) => { state.auditModuleFilter = event.target.value; render(); });
    document.getElementById("audit-user-filter")?.addEventListener("change", (event) => { state.auditUserFilter = event.target.value; render(); });
    document.getElementById("audit-severity-filter")?.addEventListener("change", (event) => { state.auditSeverityFilter = event.target.value; render(); });
    document.getElementById("audit-date-from")?.addEventListener("change", (event) => { state.auditDateFrom = event.target.value; render(); });
    document.getElementById("audit-date-to")?.addEventListener("change", (event) => { state.auditDateTo = event.target.value; render(); });
    document.querySelectorAll("[data-audit-view]").forEach((button) => button.addEventListener("click", () => { state.openAuditId = state.openAuditId === button.dataset.auditView ? "" : button.dataset.auditView; render(); }));
  }

  function bindSettingsEvents() {
    document.getElementById("edit-settings")?.addEventListener("click", () => { state.isEditingSettings = true; state.settingsDraft = clone(state.settings); state.settingsErrors = {}; state.flash = ""; render(); });
    document.getElementById("cancel-settings")?.addEventListener("click", () => { state.isEditingSettings = false; state.settingsDraft = null; state.settingsErrors = {}; render(); });
    document.getElementById("settings-form")?.addEventListener("submit", saveSettings);
  }

  async function saveSettings(event) {
    event.preventDefault();
    const settings = readSettingsForm(event.currentTarget);
    const errors = validateSettingsDraft(settings);
    if (Object.keys(errors).length > 0) { state.settingsDraft = settings; state.settingsErrors = errors; render(); return; }
    if (!window.confirm("Save workspace settings changes?")) return;
    state.isSavingSettings = true;
    render();
    try {
      const result = await requestJSON("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      state.settings = result.settings;
      state.settingsUsers = result.settingsUsers || state.settingsUsers;
      state.auditLogs = result.auditLogs || state.auditLogs;
      state.isEditingSettings = false;
      state.settingsDraft = null;
      state.settingsErrors = {};
      state.flash = result.message;
    } catch (error) {
      state.settingsErrors = error.details || {};
      state.flash = error.message || "Settings could not be saved.";
    } finally {
      state.isSavingSettings = false;
      render();
    }
  }

  function readSettingsForm(form) {
    const formData = new FormData(form);
    return {
      branding: {
        companyDisplayName: clean(formData.get("companyDisplayName")),
        companyShortName: clean(formData.get("companyShortName")),
        logoPlaceholder: clean(formData.get("logoPlaceholder")),
        brandColorPlaceholder: clean(formData.get("brandColorPlaceholder")),
        footerText: clean(formData.get("footerText")),
      },
      security: {
        sessionTimeoutMinutes: clean(formData.get("sessionTimeoutMinutes")),
        protectedRouteStatus: clean(formData.get("protectedRouteStatus")),
        passwordPolicyPlaceholder: clean(formData.get("passwordPolicyPlaceholder")),
        twoFactorAuthenticationPlaceholder: clean(formData.get("twoFactorAuthenticationPlaceholder")),
      },
      notifications: {
        complianceReminders: formData.has("complianceReminders"),
        taskReminders: formData.has("taskReminders"),
        boardMeetingReminders: formData.has("boardMeetingReminders"),
        financialMonthlyReviewReminders: formData.has("financialMonthlyReviewReminders"),
        emailNotificationPlaceholder: clean(formData.get("emailNotificationPlaceholder")),
      },
      dataBackup: {
        exportDataPlaceholder: clean(formData.get("exportDataPlaceholder")),
        importDataPlaceholder: clean(formData.get("importDataPlaceholder")),
        backupStatusPlaceholder: clean(formData.get("backupStatusPlaceholder")),
        restorePlaceholder: clean(formData.get("restorePlaceholder")),
        lastBackupPlaceholder: clean(formData.get("lastBackupPlaceholder")),
      },
      displayPreferences: {
        displayMode: clean(formData.get("displayMode")),
        compactLayout: formData.has("compactLayout"),
        printFriendlyMode: formData.has("printFriendlyMode"),
      },
      users: Array.isArray(state.settings?.users) ? state.settings.users : [],
    };
  }

  function validateSettingsDraft(settings) {
    const errors = {};
    const timeout = Number(settings.security.sessionTimeoutMinutes);
    if (!settings.branding.companyDisplayName) errors.companyDisplayName = "Company display name is required.";
    if (!Number.isFinite(timeout) || timeout <= 0) errors.sessionTimeoutMinutes = "Session timeout must be a valid number.";
    if (!DISPLAY_MODES.includes(settings.displayPreferences.displayMode)) errors.displayMode = "Display mode must be valid.";
    return errors;
  }

  function getFilteredAuditLogs() {
    const search = state.auditSearch.trim().toLowerCase();
    return state.auditLogs.filter((log) => {
      const moduleMatch = state.auditModuleFilter === "all" || log.module === state.auditModuleFilter;
      const userMatch = state.auditUserFilter === "all" || log.user === state.auditUserFilter;
      const severityMatch = state.auditSeverityFilter === "all" || log.severity === state.auditSeverityFilter;
      const date = String(log.timestamp || "").slice(0, 10);
      const fromMatch = !state.auditDateFrom || date >= state.auditDateFrom;
      const toMatch = !state.auditDateTo || date <= state.auditDateTo;
      const text = [log.actionType, log.module, log.description, log.user, log.role, log.severity, log.previousValuePlaceholder, log.newValuePlaceholder, log.ipDevicePlaceholder].join(" ").toLowerCase();
      return moduleMatch && userMatch && severityMatch && fromMatch && toMatch && (!search || text.includes(search));
    }).sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  }

  function getAuditModules() {
    return [...new Set(state.auditLogs.map((log) => log.module).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function getAuditUsers() {
    return [...new Set(state.auditLogs.map((log) => log.user).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function getPendingSettingsActions() {
    return [];
  }

  function getSecurityStatus() {
    return state.settings?.security?.protectedRouteStatus || EMPTY_TEXT;
  }

  function getLastBackupText() {
    return state.settings?.dataBackup?.lastBackupPlaceholder || EMPTY_TEXT;
  }

  function checkboxInput(name, label, checked) {
    return `<label class="checkbox-field"><input type="checkbox" id="${escapeAttribute(name)}" name="${escapeAttribute(name)}" ${checked ? "checked" : ""}><span>${escapeHTML(label)}</span></label>`;
  }

  function yesNo(value) {
    return value ? "Enabled" : "Disabled";
  }

})();




