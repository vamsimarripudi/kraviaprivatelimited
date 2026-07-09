import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "data", "company-data.json");
const PORT = Number(process.env.PORT || 4173);
const SESSION_COOKIE = "kravia_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const ROLES = new Set(["founder", "director", "viewer"]);
const MEETING_TYPES = [
  "Board Meeting",
  "Founder Meeting",
  "Finance Review",
  "Compliance Review",
  "Product Review",
  "Bank Meeting",
  "Investor Meeting",
  "Other",
];
const MEETING_STATUSES = ["Draft", "Scheduled", "Completed", "Action Pending", "Archived"];
const COMPLIANCE_CATEGORIES = [
  "MCA",
  "ROC",
  "INC-22",
  "Auditor Appointment",
  "GST Registration",
  "GST Filing",
  "Startup India",
  "Trademark",
  "MSME / Udyam",
  "EPFO",
  "ESIC",
  "Bank KYC",
  "Annual Compliance",
  "Board Resolution",
  "Legal Agreement",
  "Other",
];
const COMPLIANCE_STATUSES = [
  "Not Started",
  "In Progress",
  "Waiting for CA",
  "Waiting for Director",
  "Submitted",
  "Approved",
  "Rejected",
  "Completed",
  "Not Applicable",
];
const TASK_CATEGORIES = [
  "Founder Task",
  "Director Task",
  "CA Task",
  "Lawyer Task",
  "Bank Task",
  "Product Task",
  "Finance Task",
  "Compliance Task",
  "Document Task",
  "Investor Task",
  "Customer Task",
  "Other",
];
const TASK_STATUSES = ["To Do", "In Progress", "Waiting", "Blocked", "Done", "Archived"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const CLOSED_COMPLIANCE_STATUSES = new Set(["Approved", "Rejected", "Completed", "Not Applicable"]);
const CLOSED_TASK_STATUSES = new Set(["Done", "Archived"]);
const PRODUCT_CATEGORIES = ["VidyaLuma", "VaanMeet", "VFormix", "Future Products"];
const PRODUCT_STATUSES = ["Idea", "Planning", "Design", "Development", "Testing", "Launch Ready", "Live", "Paused"];
const PRODUCT_STAGES = ["Discovery", "Planning", "Design", "Prototype", "Development", "Testing", "Launch Preparation", "Live Operations", "Paused"];
const CONTACT_CATEGORIES = ["CA", "Lawyer", "Bank Manager", "Vendor", "Investor", "Government Contact", "Customer", "Advisor", "Consultant", "Other"];
const CONTACT_STATUSES = ["Active", "Waiting", "Follow-up Needed", "Closed", "Archived"];
const CLOSED_PRODUCT_STATUSES = new Set(["Paused"]);
const CLOSED_CONTACT_STATUSES = new Set(["Closed", "Archived"]);
const AUDIT_SEVERITIES = ["Info", "Important", "Warning", "Critical"];
const DISPLAY_MODES = ["light", "dark", "system"];
const AUDIT_LOG_LIMIT = 1000;
const ECOSYSTEM_PRODUCT_STATUSES = ["IDEA", "DEVELOPMENT", "TESTING", "STAGING", "LAUNCH_READY", "LIVE", "PAUSED", "ARCHIVED"];
const ECOSYSTEM_LAUNCH_STATUSES = ["NOT_STARTED", "PLANNED", "IN_PROGRESS", "BLOCKED", "LAUNCH_READY", "LAUNCHED", "NOT_APPLICABLE"];
const ECOSYSTEM_REVENUE_STATUSES = ["NOT_STARTED", "NOT_VISIBLE", "TRACKING_READY", "REVENUE_ACTIVE", "PAUSED", "NOT_APPLICABLE"];
const ECOSYSTEM_COMPLIANCE_STATUSES = ["NOT_REVIEWED", "REVIEW_REQUIRED", "IN_REVIEW", "COMPLIANT", "BLOCKED", "NOT_APPLICABLE"];
const ECOSYSTEM_SECURITY_STATUSES = ["NOT_REVIEWED", "REVIEW_REQUIRED", "IN_REVIEW", "SECURE", "RISK_IDENTIFIED", "NOT_APPLICABLE"];
const ECOSYSTEM_DEPLOYMENT_STATUSES = ["NOT_DEPLOYED", "LOCAL", "STAGING", "PRODUCTION", "FAILED", "PAUSED"];
let ecosystemPgPoolPromise = null;
let ecosystemPgSchemaReady = false;

await loadEnvFile();

const staticFiles = new Map([
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
  ["/login.js", "login.js"],
]);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    console.error(error);
    sendJSON(response, 500, { message: "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`KRAVIA internal workspace running at http://localhost:${PORT}`);
});

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const session = readSession(request);

  if (request.method === "GET" && url.pathname === "/") {
    redirect(response, session ? "/workspace" : "/login");
    return;
  }

  if (request.method === "GET" && url.pathname === "/login") {
    await sendFile(response, join(__dirname, "login.html"));
    return;
  }

  if (request.method === "GET" && url.pathname === "/favicon.ico") {
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/workspace") {
    if (!session) {
      redirect(response, "/login");
      return;
    }
    await sendFile(response, join(__dirname, "index.html"));
    return;
  }

  if (request.method === "GET" && staticFiles.has(url.pathname)) {
    await sendFile(response, join(__dirname, staticFiles.get(url.pathname)));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    await routeAPI(request, response, url, session);
    return;
  }

  sendJSON(response, 404, { message: "Not found." });
}

async function routeAPI(request, response, url, session) {
  if (request.method === "GET" && url.pathname === "/api/session") {
    if (!session) {
      sendJSON(response, 401, { message: "Authentication required." });
      return;
    }
    sendJSON(response, 200, { user: publicUser(session) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    await login(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    if (session) {
      const data = await readCompanyData();
      recordAuditLog(data, session, request, {
        actionType: "Logout",
        module: "Authentication",
        description: "User logged out.",
        severity: "Info",
      });
      await writeCompanyData(data);
    }
    response.setHeader("Set-Cookie", clearSessionCookie());
    sendJSON(response, 200, { message: "Logged out." });
    return;
  }

  if (!session) {
    sendJSON(response, 401, { message: "Authentication required." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    const data = await readCompanyData();
    sendJSON(response, 200, buildBootstrapPayload(data, session));
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/company-profile") {
    await requireRole(response, session, ["founder", "director"], async () => {
      const body = await readJSONBody(request);
      const validation = validateProfile(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Company profile validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const previousProfile = data.company.profile;
      data.company.profile = validation.profile;
      data.company.name = validation.profile.companyName || data.company.name;
      recordAuditLog(data, session, request, {
        actionType: "Profile Updated",
        module: "Company Profile",
        description: "Company profile was edited.",
        severity: "Important",
        previousValue: settingsAuditSnapshot({ branding: { companyDisplayName: previousProfile.companyName || data.company.name } }),
        newValue: settingsAuditSnapshot({ branding: { companyDisplayName: validation.profile.companyName || data.company.name } }),
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Company profile saved.",
        company: {
          name: data.company.name,
          subtitle: data.company.subtitle,
        },
        profile: data.company.profile,
      });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/documents/upload-placeholder") {
    await requireRole(response, session, ["founder"], async () => {
      const body = await readJSONBody(request);
      const errors = {};
      if (!clean(body.title)) {
        errors.documentTitle = "Document title is required.";
      }
      if (!clean(body.categoryId)) {
        errors.documentCategory = "Document category is required.";
      }
      if (Object.keys(errors).length > 0) {
        sendJSON(response, 400, {
          message: "Upload placeholder validation failed.",
          details: errors,
        });
        return;
      }

      const data = await readCompanyData();
      const categoryExists = data.documents.categories.some((category) => category.id === body.categoryId);
      if (!categoryExists) {
        sendJSON(response, 400, {
          message: "Selected document category is not available.",
          details: { documentCategory: "Select a valid document category." },
        });
        return;
      }

      recordAuditLog(data, session, request, {
        actionType: "Document Upload Placeholder",
        module: "Document Vault",
        description: "Document upload placeholder was prepared.",
        severity: "Info",
        newValue: clean(body.title),
      });
      await writeCompanyData(data);

      sendJSON(response, 202, {
        message: "Upload placeholder prepared. Connect a storage backend before accepting files.",
      });
    });
    return;
  }

  const documentAction = url.pathname.match(/^\/api\/documents\/([^/]+)\/(view|download)$/);
  if (request.method === "POST" && documentAction) {
    const action = documentAction[2];
    sendJSON(response, 202, {
      message: `${capitalize(action)} action placeholder is ready for future vault storage integration.`,
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/board-meetings") {
    await requireRole(response, session, ["founder", "director"], async () => {
      const body = await readJSONBody(request);
      const validation = validateMeeting(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Board meeting validation failed.",
          details: validation.errors,
        });
        return;
      }
      if (validation.meeting.status === "Archived" && session.role !== "founder") {
        sendJSON(response, 403, { message: "Only founders can archive meeting records." });
        return;
      }

      const data = await readCompanyData();
      const now = new Date().toISOString();
      const meeting = {
        id: makeId("meet"),
        ...validation.meeting,
        archived: validation.meeting.status === "Archived",
        createdBy: session.name || session.email,
        createdAt: now,
        lastUpdated: now,
      };
      data.boardMeetings.records.unshift(meeting);
      recordAuditLog(data, session, request, {
        actionType: "Meeting Created",
        module: "Board Meetings",
        description: "Board meeting record was created.",
        severity: "Important",
        newValue: meeting.meetingTitle,
      });
      await writeCompanyData(data);
      sendJSON(response, 201, {
        message: "Board meeting record created.",
        meeting,
        boardMeetings: data.boardMeetings.records,
      });
    });
    return;
  }

  const meetingEdit = url.pathname.match(/^\/api\/board-meetings\/([^/]+)$/);
  if (request.method === "PUT" && meetingEdit) {
    await requireRole(response, session, ["founder", "director"], async () => {
      const id = decodeURIComponent(meetingEdit[1]);
      const body = await readJSONBody(request);
      const validation = validateMeeting(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Board meeting validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const index = data.boardMeetings.records.findIndex((meeting) => meeting.id === id);
      if (index === -1) {
        sendJSON(response, 404, { message: "Board meeting record was not found." });
        return;
      }

      const existing = data.boardMeetings.records[index];
      const movingToArchive = validation.meeting.status === "Archived" && existing.status !== "Archived";
      if (movingToArchive && session.role !== "founder") {
        sendJSON(response, 403, { message: "Only founders can archive meeting records." });
        return;
      }

      const updated = {
        ...existing,
        ...validation.meeting,
        archived: validation.meeting.status === "Archived",
        lastUpdated: new Date().toISOString(),
      };
      data.boardMeetings.records[index] = updated;
      recordAuditLog(data, session, request, {
        actionType: "Meeting Updated",
        module: "Board Meetings",
        description: "Board meeting record was edited.",
        severity: "Important",
        previousValue: existing.meetingTitle,
        newValue: updated.meetingTitle,
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Board meeting record saved.",
        meeting: updated,
        boardMeetings: data.boardMeetings.records,
      });
    });
    return;
  }

  const meetingArchive = url.pathname.match(/^\/api\/board-meetings\/([^/]+)\/archive$/);
  if (request.method === "POST" && meetingArchive) {
    await requireRole(response, session, ["founder"], async () => {
      const id = decodeURIComponent(meetingArchive[1]);
      const data = await readCompanyData();
      const meeting = data.boardMeetings.records.find((record) => record.id === id);
      if (!meeting) {
        sendJSON(response, 404, { message: "Board meeting record was not found." });
        return;
      }
      meeting.status = "Archived";
      meeting.archived = true;
      meeting.lastUpdated = new Date().toISOString();
      recordAuditLog(data, session, request, {
        actionType: "Meeting Archived",
        module: "Board Meetings",
        description: "Board meeting record was archived.",
        severity: "Warning",
        previousValue: meeting.meetingTitle,
        newValue: "Archived",
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Board meeting record archived.",
        meeting,
        boardMeetings: data.boardMeetings.records,
      });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/financial-records") {
    await requireRole(response, session, ["founder", "director"], async () => {
      const body = await readJSONBody(request);
      const validation = validateFinancialRecord(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Financial record validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const duplicate = data.financials.records.find((record) => record.reportingMonth === validation.record.reportingMonth);
      if (duplicate) {
        sendJSON(response, 409, {
          message: "A financial record already exists for this reporting month.",
          details: { reportingMonth: "Edit the existing month or choose another month." },
        });
        return;
      }

      const now = new Date().toISOString();
      const record = {
        id: makeId("fin"),
        ...validation.record,
        createdBy: session.name || session.email,
        createdAt: now,
        lastUpdated: now,
      };
      data.financials.records.unshift(record);
      sortFinancialRecords(data.financials.records);
      recordAuditLog(data, session, request, {
        actionType: "Financial Record Created",
        module: "Financial Dashboard",
        description: "Monthly financial record was created.",
        severity: "Important",
        newValue: record.reportingMonth,
      });
      await writeCompanyData(data);
      sendJSON(response, 201, {
        message: "Financial record created.",
        financialRecord: record,
        financialRecords: data.financials.records,
    complianceCategories: data.compliance.categories,
    complianceStatuses: data.compliance.statusOptions,
    compliancePriorities: data.compliance.priorityOptions,
    complianceItems: data.compliance.records,
    taskCategories: data.tasks.categories,
    taskStatuses: data.tasks.statusOptions,
    taskPriorities: data.tasks.priorityOptions,
    tasks: data.tasks.records,
      });
    });
    return;
  }

  const financialEdit = url.pathname.match(/^\/api\/financial-records\/([^/]+)$/);
  if (request.method === "PUT" && financialEdit) {
    await requireRole(response, session, ["founder", "director"], async () => {
      const id = decodeURIComponent(financialEdit[1]);
      const body = await readJSONBody(request);
      const validation = validateFinancialRecord(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Financial record validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const index = data.financials.records.findIndex((record) => record.id === id);
      if (index === -1) {
        sendJSON(response, 404, { message: "Financial record was not found." });
        return;
      }
      const duplicate = data.financials.records.find((record) => record.id !== id && record.reportingMonth === validation.record.reportingMonth);
      if (duplicate) {
        sendJSON(response, 409, {
          message: "A financial record already exists for this reporting month.",
          details: { reportingMonth: "Edit the existing month or choose another month." },
        });
        return;
      }

      const existing = data.financials.records[index];
      const updated = {
        ...existing,
        ...validation.record,
        lastUpdated: new Date().toISOString(),
      };
      data.financials.records[index] = updated;
      sortFinancialRecords(data.financials.records);
      recordAuditLog(data, session, request, {
        actionType: "Financial Record Updated",
        module: "Financial Dashboard",
        description: "Monthly financial record was edited.",
        severity: "Important",
        previousValue: existing.reportingMonth,
        newValue: updated.reportingMonth,
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Financial record saved.",
        financialRecord: updated,
        financialRecords: data.financials.records,
    complianceCategories: data.compliance.categories,
    complianceStatuses: data.compliance.statusOptions,
    compliancePriorities: data.compliance.priorityOptions,
    complianceItems: data.compliance.records,
    taskCategories: data.tasks.categories,
    taskStatuses: data.tasks.statusOptions,
    taskPriorities: data.tasks.priorityOptions,
    tasks: data.tasks.records,
      });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/compliance-items") {
    await requireRole(response, session, ["founder", "director"], async () => {
      const body = await readJSONBody(request);
      const validation = validateComplianceItem(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Compliance item validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const now = new Date().toISOString();
      const complianceItem = {
        id: makeId("comp"),
        ...validation.complianceItem,
        archived: false,
        createdBy: session.name || session.email,
        createdAt: now,
        lastUpdated: now,
      };
      data.compliance.records.unshift(complianceItem);
      sortDueDatedRecords(data.compliance.records);
      recordAuditLog(data, session, request, {
        actionType: "Compliance Created",
        module: "Compliance Center",
        description: "Compliance item was created.",
        severity: "Important",
        newValue: complianceItem.complianceTitle,
      });
      await writeCompanyData(data);
      sendJSON(response, 201, {
        message: "Compliance item created.",
        complianceItem,
        complianceItems: data.compliance.records,
      });
    });
    return;
  }

  const complianceEdit = url.pathname.match(/^\/api\/compliance-items\/([^/]+)$/);
  if (request.method === "PUT" && complianceEdit) {
    await requireRole(response, session, ["founder", "director"], async () => {
      const id = decodeURIComponent(complianceEdit[1]);
      const body = await readJSONBody(request);
      const validation = validateComplianceItem(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Compliance item validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const index = data.compliance.records.findIndex((item) => item.id === id);
      if (index === -1) {
        sendJSON(response, 404, { message: "Compliance item was not found." });
        return;
      }

      const existing = data.compliance.records[index];
      const updated = {
        ...existing,
        ...validation.complianceItem,
        archived: Boolean(existing.archived),
        lastUpdated: new Date().toISOString(),
      };
      data.compliance.records[index] = updated;
      sortDueDatedRecords(data.compliance.records);
      recordAuditLog(data, session, request, {
        actionType: "Compliance Updated",
        module: "Compliance Center",
        description: "Compliance item was edited.",
        severity: "Important",
        previousValue: existing.complianceTitle,
        newValue: updated.complianceTitle,
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Compliance item saved.",
        complianceItem: updated,
        complianceItems: data.compliance.records,
      });
    });
    return;
  }

  const complianceArchive = url.pathname.match(/^\/api\/compliance-items\/([^/]+)\/archive$/);
  if (request.method === "POST" && complianceArchive) {
    await requireRole(response, session, ["founder"], async () => {
      const id = decodeURIComponent(complianceArchive[1]);
      const data = await readCompanyData();
      const complianceItem = data.compliance.records.find((item) => item.id === id);
      if (!complianceItem) {
        sendJSON(response, 404, { message: "Compliance item was not found." });
        return;
      }
      complianceItem.archived = true;
      complianceItem.lastUpdated = new Date().toISOString();
      sortDueDatedRecords(data.compliance.records);
      recordAuditLog(data, session, request, {
        actionType: "Compliance Archived",
        module: "Compliance Center",
        description: "Compliance item was archived.",
        severity: "Warning",
        previousValue: complianceItem.complianceTitle,
        newValue: "Archived",
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Compliance item archived.",
        complianceItem,
        complianceItems: data.compliance.records,
      });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks") {
    await requireRole(response, session, ["founder", "director"], async () => {
      const body = await readJSONBody(request);
      const validation = validateTask(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Company task validation failed.",
          details: validation.errors,
        });
        return;
      }
      if (validation.task.status === "Archived" && session.role !== "founder") {
        sendJSON(response, 403, { message: "Only founders can archive company tasks." });
        return;
      }

      const data = await readCompanyData();
      const now = new Date().toISOString();
      const task = {
        id: makeId("task"),
        ...validation.task,
        archived: validation.task.status === "Archived",
        createdBy: session.name || session.email,
        createdAt: now,
        lastUpdated: now,
      };
      data.tasks.records.unshift(task);
      sortDueDatedRecords(data.tasks.records);
      recordAuditLog(data, session, request, {
        actionType: "Task Created",
        module: "Company Tasks",
        description: "Company task was created.",
        severity: "Important",
        newValue: task.taskTitle,
      });
      await writeCompanyData(data);
      sendJSON(response, 201, {
        message: "Company task created.",
        task,
        tasks: data.tasks.records,
      });
    });
    return;
  }

  const taskEdit = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (request.method === "PUT" && taskEdit) {
    await requireRole(response, session, ["founder", "director"], async () => {
      const id = decodeURIComponent(taskEdit[1]);
      const body = await readJSONBody(request);
      const validation = validateTask(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Company task validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const index = data.tasks.records.findIndex((task) => task.id === id);
      if (index === -1) {
        sendJSON(response, 404, { message: "Company task was not found." });
        return;
      }

      const existing = data.tasks.records[index];
      const movingToArchive = validation.task.status === "Archived" && existing.status !== "Archived";
      if (movingToArchive && session.role !== "founder") {
        sendJSON(response, 403, { message: "Only founders can archive company tasks." });
        return;
      }

      const updated = {
        ...existing,
        ...validation.task,
        archived: validation.task.status === "Archived",
        lastUpdated: new Date().toISOString(),
      };
      data.tasks.records[index] = updated;
      sortDueDatedRecords(data.tasks.records);
      recordAuditLog(data, session, request, {
        actionType: "Task Updated",
        module: "Company Tasks",
        description: "Company task was edited.",
        severity: "Important",
        previousValue: existing.taskTitle,
        newValue: updated.taskTitle,
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Company task saved.",
        task: updated,
        tasks: data.tasks.records,
      });
    });
    return;
  }

  const taskDone = url.pathname.match(/^\/api\/tasks\/([^/]+)\/done$/);
  if (request.method === "POST" && taskDone) {
    await requireRole(response, session, ["founder", "director"], async () => {
      const id = decodeURIComponent(taskDone[1]);
      const data = await readCompanyData();
      const task = data.tasks.records.find((record) => record.id === id);
      if (!task) {
        sendJSON(response, 404, { message: "Company task was not found." });
        return;
      }
      task.status = "Done";
      task.archived = false;
      task.lastUpdated = new Date().toISOString();
      sortDueDatedRecords(data.tasks.records);
      recordAuditLog(data, session, request, {
        actionType: "Task Status Changed",
        module: "Company Tasks",
        description: "Company task was marked done.",
        severity: "Important",
        previousValue: task.taskTitle,
        newValue: "Done",
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Company task marked done.",
        task,
        tasks: data.tasks.records,
      });
    });
    return;
  }

  const taskArchive = url.pathname.match(/^\/api\/tasks\/([^/]+)\/archive$/);
  if (request.method === "POST" && taskArchive) {
    await requireRole(response, session, ["founder"], async () => {
      const id = decodeURIComponent(taskArchive[1]);
      const data = await readCompanyData();
      const task = data.tasks.records.find((record) => record.id === id);
      if (!task) {
        sendJSON(response, 404, { message: "Company task was not found." });
        return;
      }
      task.status = "Archived";
      task.archived = true;
      task.lastUpdated = new Date().toISOString();
      sortDueDatedRecords(data.tasks.records);
      recordAuditLog(data, session, request, {
        actionType: "Task Archived",
        module: "Company Tasks",
        description: "Company task was archived.",
        severity: "Warning",
        previousValue: task.taskTitle,
        newValue: "Archived",
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Company task archived.",
        task,
        tasks: data.tasks.records,
      });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/products") {
    await requireRole(response, session, ["founder", "director"], async () => {
      const body = await readJSONBody(request);
      const validation = validateProduct(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Product validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const now = new Date().toISOString();
      const product = {
        id: makeId("prod"),
        ...validation.product,
        archived: false,
        createdBy: session.name || session.email,
        createdAt: now,
        lastUpdated: now,
      };
      data.products.records.unshift(product);
      sortUpdatedRecords(data.products.records);
      recordAuditLog(data, session, request, {
        actionType: "Product Created",
        module: "Products Portfolio",
        description: "Product record was created.",
        severity: "Important",
        newValue: product.productName,
      });
      await writeCompanyData(data);
      sendJSON(response, 201, {
        message: "Product record created.",
        product,
        products: data.products.records,
      });
    });
    return;
  }

  const productEdit = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (request.method === "PUT" && productEdit) {
    await requireRole(response, session, ["founder", "director"], async () => {
      const id = decodeURIComponent(productEdit[1]);
      const body = await readJSONBody(request);
      const validation = validateProduct(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Product validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const index = data.products.records.findIndex((product) => product.id === id);
      if (index === -1) {
        sendJSON(response, 404, { message: "Product record was not found." });
        return;
      }

      const existing = data.products.records[index];
      const updated = {
        ...existing,
        ...validation.product,
        archived: Boolean(existing.archived),
        lastUpdated: new Date().toISOString(),
      };
      data.products.records[index] = updated;
      sortUpdatedRecords(data.products.records);
      recordAuditLog(data, session, request, {
        actionType: "Product Updated",
        module: "Products Portfolio",
        description: "Product record was edited.",
        severity: "Important",
        previousValue: existing.productName,
        newValue: updated.productName,
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Product record saved.",
        product: updated,
        products: data.products.records,
      });
    });
    return;
  }

  const productArchive = url.pathname.match(/^\/api\/products\/([^/]+)\/archive$/);
  if (request.method === "POST" && productArchive) {
    await requireRole(response, session, ["founder"], async () => {
      const id = decodeURIComponent(productArchive[1]);
      const data = await readCompanyData();
      const product = data.products.records.find((record) => record.id === id);
      if (!product) {
        sendJSON(response, 404, { message: "Product record was not found." });
        return;
      }
      product.archived = true;
      product.lastUpdated = new Date().toISOString();
      sortUpdatedRecords(data.products.records);
      recordAuditLog(data, session, request, {
        actionType: "Product Archived",
        module: "Products Portfolio",
        description: "Product record was archived.",
        severity: "Warning",
        previousValue: product.productName,
        newValue: "Archived",
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Product record archived.",
        product,
        products: data.products.records,
      });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/contacts") {
    await requireRole(response, session, ["founder", "director"], async () => {
      const body = await readJSONBody(request);
      const validation = validateContact(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Contact validation failed.",
          details: validation.errors,
        });
        return;
      }
      if (validation.contact.status === "Archived" && session.role !== "founder") {
        sendJSON(response, 403, { message: "Only founders can archive contacts." });
        return;
      }

      const data = await readCompanyData();
      const now = new Date().toISOString();
      const contact = {
        id: makeId("ctc"),
        ...validation.contact,
        archived: validation.contact.status === "Archived",
        createdBy: session.name || session.email,
        createdAt: now,
        lastUpdated: now,
      };
      data.contacts.records.unshift(contact);
      sortUpdatedRecords(data.contacts.records);
      recordAuditLog(data, session, request, {
        actionType: "Contact Created",
        module: "Contacts & Partners",
        description: "Contact was created.",
        severity: "Important",
        newValue: contact.name,
      });
      await writeCompanyData(data);
      sendJSON(response, 201, {
        message: "Contact created.",
        contact,
        contacts: data.contacts.records,
      });
    });
    return;
  }

  const contactEdit = url.pathname.match(/^\/api\/contacts\/([^/]+)$/);
  if (request.method === "PUT" && contactEdit) {
    await requireRole(response, session, ["founder", "director"], async () => {
      const id = decodeURIComponent(contactEdit[1]);
      const body = await readJSONBody(request);
      const validation = validateContact(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Contact validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const index = data.contacts.records.findIndex((contact) => contact.id === id);
      if (index === -1) {
        sendJSON(response, 404, { message: "Contact was not found." });
        return;
      }

      const existing = data.contacts.records[index];
      const movingToArchive = validation.contact.status === "Archived" && existing.status !== "Archived";
      if (movingToArchive && session.role !== "founder") {
        sendJSON(response, 403, { message: "Only founders can archive contacts." });
        return;
      }

      const updated = {
        ...existing,
        ...validation.contact,
        archived: validation.contact.status === "Archived",
        lastUpdated: new Date().toISOString(),
      };
      data.contacts.records[index] = updated;
      sortUpdatedRecords(data.contacts.records);
      recordAuditLog(data, session, request, {
        actionType: "Contact Updated",
        module: "Contacts & Partners",
        description: "Contact was edited.",
        severity: "Important",
        previousValue: existing.name,
        newValue: updated.name,
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Contact saved.",
        contact: updated,
        contacts: data.contacts.records,
      });
    });
    return;
  }

  const contactArchive = url.pathname.match(/^\/api\/contacts\/([^/]+)\/archive$/);
  if (request.method === "POST" && contactArchive) {
    await requireRole(response, session, ["founder"], async () => {
      const id = decodeURIComponent(contactArchive[1]);
      const data = await readCompanyData();
      const contact = data.contacts.records.find((record) => record.id === id);
      if (!contact) {
        sendJSON(response, 404, { message: "Contact was not found." });
        return;
      }
      contact.status = "Archived";
      contact.archived = true;
      contact.lastUpdated = new Date().toISOString();
      sortUpdatedRecords(data.contacts.records);
      recordAuditLog(data, session, request, {
        actionType: "Contact Archived",
        module: "Contacts & Partners",
        description: "Contact was archived.",
        severity: "Warning",
        previousValue: contact.name,
        newValue: "Archived",
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Contact archived.",
        contact,
        contacts: data.contacts.records,
      });
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ecosystem/summary") {
    const data = await readCompanyData();
    sendJSON(response, 200, {
      summary: buildEcosystemSummary(data.ecosystem.products),
      persistence: ecosystemPersistenceMode(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ecosystem/products") {
    const data = await readCompanyData();
    sendJSON(response, 200, {
      products: data.ecosystem.products,
      summary: buildEcosystemSummary(data.ecosystem.products),
      statusOptions: data.ecosystem.statusOptions,
      launchStatusOptions: data.ecosystem.launchStatusOptions,
      revenueStatusOptions: data.ecosystem.revenueStatusOptions,
      complianceStatusOptions: data.ecosystem.complianceStatusOptions,
      securityStatusOptions: data.ecosystem.securityStatusOptions,
      deploymentStatusOptions: data.ecosystem.deploymentStatusOptions,
      persistence: ecosystemPersistenceMode(),
    });
    return;
  }

  const ecosystemProductRoute = url.pathname.match(/^\/api\/ecosystem\/products\/([^/]+)$/);
  if (request.method === "GET" && ecosystemProductRoute) {
    const id = decodeURIComponent(ecosystemProductRoute[1]);
    const data = await readCompanyData();
    const product = data.ecosystem.products.find((record) => record.id === id);
    if (!product) {
      sendJSON(response, 404, { message: "Ecosystem product was not found." });
      return;
    }
    sendJSON(response, 200, { product });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ecosystem/products") {
    await requireRole(response, session, ["founder"], async () => {
      const body = await readJSONBody(request);
      const validation = validateEcosystemProduct(body);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Ecosystem product validation failed.",
          details: validation.errors,
        });
        return;
      }

      const data = await readCompanyData();
      const duplicate = data.ecosystem.products.find((record) => record.productCode === validation.product.productCode);
      if (duplicate) {
        sendJSON(response, 409, { message: "An ecosystem product with this product code already exists." });
        return;
      }
      const now = new Date().toISOString();
      const product = {
        id: makeId("eco"),
        ...validation.product,
        archived: validation.product.status === "ARCHIVED",
        createdBy: session.name || session.email,
        createdAt: now,
        lastUpdated: now,
      };
      data.ecosystem.products.unshift(product);
      sortUpdatedRecords(data.ecosystem.products);
      await persistEcosystemProduct(product);
      recordAuditLog(data, session, request, {
        actionType: "Ecosystem Product Created",
        module: "Ecosystem Control Plane",
        description: "Ecosystem product record was created.",
        severity: "Important",
        newValue: ecosystemAuditSnapshot(product),
      });
      await writeCompanyData(data);
      sendJSON(response, 201, buildEcosystemResponse(data, product, "Ecosystem product created."));
    });
    return;
  }

  if (request.method === "PUT" && ecosystemProductRoute) {
    await requireRole(response, session, ["founder", "director"], async () => {
      const id = decodeURIComponent(ecosystemProductRoute[1]);
      const body = await readJSONBody(request);
      const data = await readCompanyData();
      const index = data.ecosystem.products.findIndex((record) => record.id === id);
      if (index === -1) {
        sendJSON(response, 404, { message: "Ecosystem product was not found." });
        return;
      }
      const existing = data.ecosystem.products[index];
      const validation = session.role === "director" ? validateEcosystemStatusUpdate(body, existing) : validateEcosystemProduct(body, existing);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Ecosystem product validation failed.",
          details: validation.errors,
        });
        return;
      }
      if (session.role === "founder" && validation.product.productCode !== existing.productCode) {
        const duplicate = data.ecosystem.products.find((record) => record.id !== id && record.productCode === validation.product.productCode);
        if (duplicate) {
          sendJSON(response, 409, { message: "An ecosystem product with this product code already exists." });
          return;
        }
      }
      const updated = session.role === "director"
        ? { ...existing, ...validation.statuses, archived: validation.statuses.status === "ARCHIVED" ? true : existing.archived, lastUpdated: new Date().toISOString() }
        : { ...existing, ...validation.product, archived: validation.product.status === "ARCHIVED", lastUpdated: new Date().toISOString() };
      data.ecosystem.products[index] = updated;
      sortUpdatedRecords(data.ecosystem.products);
      await persistEcosystemProduct(updated);
      recordAuditLog(data, session, request, {
        actionType: session.role === "director" ? "Ecosystem Product Status Updated" : "Ecosystem Product Updated",
        module: "Ecosystem Control Plane",
        description: session.role === "director" ? "Ecosystem product status fields were updated." : "Ecosystem product record was edited.",
        severity: updated.status === "ARCHIVED" || updated.securityStatus === "RISK_IDENTIFIED" ? "Warning" : "Important",
        previousValue: ecosystemAuditSnapshot(existing),
        newValue: ecosystemAuditSnapshot(updated),
      });
      await writeCompanyData(data);
      sendJSON(response, 200, buildEcosystemResponse(data, updated, "Ecosystem product saved."));
    });
    return;
  }

  if (request.method === "DELETE" && ecosystemProductRoute) {
    await requireRole(response, session, ["founder"], async () => {
      const id = decodeURIComponent(ecosystemProductRoute[1]);
      const data = await readCompanyData();
      const product = data.ecosystem.products.find((record) => record.id === id);
      if (!product) {
        sendJSON(response, 404, { message: "Ecosystem product was not found." });
        return;
      }
      const previousProduct = { ...product };
      product.status = "ARCHIVED";
      product.archived = true;
      product.lastUpdated = new Date().toISOString();
      sortUpdatedRecords(data.ecosystem.products);
      await persistEcosystemProduct(product);
      recordAuditLog(data, session, request, {
        actionType: "Ecosystem Product Archived",
        module: "Ecosystem Control Plane",
        description: "Ecosystem product record was archived.",
        severity: "Warning",
        previousValue: ecosystemAuditSnapshot(previousProduct),
        newValue: ecosystemAuditSnapshot(product),
      });
      await writeCompanyData(data);
      sendJSON(response, 200, buildEcosystemResponse(data, product, "Ecosystem product archived."));
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/audit-logs") {
    await requireRole(response, session, ["founder", "director"], async () => {
      const data = await readCompanyData();
      sendJSON(response, 200, {
        auditLogs: data.audit.records,
        auditSeverities: AUDIT_SEVERITIES,
      });
    });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/settings") {
    await requireRole(response, session, ["founder"], async () => {
      const body = await readJSONBody(request);
      const data = await readCompanyData();
      const validation = validateSettings(body, data.settings, data);
      if (!validation.valid) {
        sendJSON(response, 400, {
          message: "Settings validation failed.",
          details: validation.errors,
        });
        return;
      }

      const previousSettings = data.settings;
      data.settings = validation.settings;
      recordAuditLog(data, session, request, {
        actionType: "Settings Updated",
        module: "Settings",
        description: "Workspace settings were updated.",
        severity: "Important",
        previousValue: settingsAuditSnapshot(previousSettings),
        newValue: settingsAuditSnapshot(validation.settings),
      });
      await writeCompanyData(data);
      sendJSON(response, 200, {
        message: "Settings saved.",
        settings: buildSettingsPayload(data, session),
        settingsUsers: buildSettingsUsers(data.audit.records),
        auditLogs: data.audit.records,
      });
    });
    return;
  }

  sendJSON(response, 404, { message: "API route not found." });
}

function buildBootstrapPayload(data, session) {
  const permissions = permissionsForRole(session.role);
  return {
    user: publicUser(session),
    permissions,
    company: {
      name: data.company.name,
      subtitle: data.company.subtitle,
    },
    profile: data.company.profile,
    documentCategories: data.documents.categories,
    documents: data.documents.records,
    boardMeetingTypes: data.boardMeetings.meetingTypes,
    boardMeetingStatuses: data.boardMeetings.statusOptions,
    boardMeetings: data.boardMeetings.records,
    financialRecords: data.financials.records,
    complianceCategories: data.compliance.categories,
    complianceStatuses: data.compliance.statusOptions,
    compliancePriorities: data.compliance.priorityOptions,
    complianceItems: data.compliance.records,
    taskCategories: data.tasks.categories,
    taskStatuses: data.tasks.statusOptions,
    taskPriorities: data.tasks.priorityOptions,
    tasks: data.tasks.records,
    productCategories: data.products.categories,
    productStatuses: data.products.statusOptions,
    productStages: data.products.stageOptions,
    products: data.products.records,
    contactCategories: data.contacts.categories,
    contactStatuses: data.contacts.statusOptions,
    contacts: data.contacts.records,
    ecosystemProducts: data.ecosystem.products,
    ecosystemStatusOptions: data.ecosystem.statusOptions,
    ecosystemLaunchStatusOptions: data.ecosystem.launchStatusOptions,
    ecosystemRevenueStatusOptions: data.ecosystem.revenueStatusOptions,
    ecosystemComplianceStatusOptions: data.ecosystem.complianceStatusOptions,
    ecosystemSecurityStatusOptions: data.ecosystem.securityStatusOptions,
    ecosystemDeploymentStatusOptions: data.ecosystem.deploymentStatusOptions,
    ecosystemSummary: buildEcosystemSummary(data.ecosystem.products),
    ecosystemPersistence: ecosystemPersistenceMode(),
    auditLogs: permissions.canViewAuditLogs ? data.audit.records : [],
    auditSeverities: permissions.canViewAuditLogs ? AUDIT_SEVERITIES : [],
    settings: permissions.canViewSettings ? buildSettingsPayload(data, session) : null,
    settingsUsers: permissions.canViewSettings ? buildSettingsUsers(data.audit.records) : [],
  };
}

async function login(request, response) {
  const users = getConfiguredUsers();
  if (!process.env.KRAVIA_SESSION_SECRET || users.length === 0) {
    sendJSON(response, 503, {
      message: "Authentication is not configured. Set KRAVIA_SESSION_SECRET and KRAVIA_AUTH_USERS.",
    });
    return;
  }

  const body = await readJSONBody(request);
  const email = clean(body.email).toLowerCase();
  const password = String(body.password || "");
  const user = users.find((candidate) => candidate.email.toLowerCase() === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    sendJSON(response, 401, { message: "Invalid email or password." });
    return;
  }

  if (!ROLES.has(user.role)) {
    sendJSON(response, 403, { message: "User role is not allowed." });
    return;
  }

  const session = createSession({
    email: user.email,
    name: user.name || user.email,
    role: user.role,
  });

  const data = await readCompanyData();
  recordAuditLog(data, user, request, {
    actionType: "Login",
    module: "Authentication",
    description: "User logged in.",
    severity: "Info",
  });
  await writeCompanyData(data);

  response.setHeader("Set-Cookie", sessionCookie(session));
  sendJSON(response, 200, { user: publicUser(user) });
}

function getConfiguredUsers() {
  if (!process.env.KRAVIA_AUTH_USERS) {
    return [];
  }

  try {
    const users = JSON.parse(process.env.KRAVIA_AUTH_USERS);
    return Array.isArray(users) ? users : [];
  } catch (_error) {
    return [];
  }
}

function createSession(user) {
  const payload = {
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    nonce: randomBytes(12).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function readSession(request) {
  const cookieHeader = request.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter((cookie) => cookie.includes("="))
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );

  const token = cookies[SESSION_COOKIE];
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!safeEqual(signature, sign(encoded))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now() || !ROLES.has(payload.role)) {
      return null;
    }
    return payload;
  } catch (_error) {
    return null;
  }
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") {
    return false;
  }

  const [, digest, iterationsValue, saltValue, hashValue] = parts;
  const iterations = Number(iterationsValue);
  if (!Number.isInteger(iterations) || iterations < 100000) {
    return false;
  }

  const expected = Buffer.from(hashValue, "base64url");
  const actual = pbkdf2Sync(password, Buffer.from(saltValue, "base64url"), iterations, expected.length, digest);
  return safeEqual(actual, expected);
}

function sign(value) {
  return createHmac("sha256", process.env.KRAVIA_SESSION_SECRET || "")
    .update(value)
    .digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.isBuffer(a) ? a : Buffer.from(String(a || ""));
  const right = Buffer.isBuffer(b) ? b : Buffer.from(String(b || ""));
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function publicUser(user) {
  return {
    email: user.email,
    name: user.name || user.email,
    role: user.role,
  };
}

function permissionsForRole(role) {
  const canEdit = role === "founder" || role === "director";
  return {
    canEditProfile: canEdit,
    canManageDocuments: role === "founder",
    canManageMeetings: canEdit,
    canArchiveMeetings: role === "founder",
    canEditFinancials: canEdit,
    canManageCompliance: canEdit,
    canArchiveCompliance: role === "founder",
    canManageTasks: canEdit,
    canArchiveTasks: role === "founder",
    canCompleteTasks: canEdit,
    canManageProducts: canEdit,
    canArchiveProducts: role === "founder",
    canManageContacts: canEdit,
    canArchiveContacts: role === "founder",
    canViewEcosystem: true,
    canManageEcosystem: role === "founder",
    canUpdateEcosystemStatus: role === "founder" || role === "director",
    canDeleteEcosystemProducts: role === "founder",
    canViewAuditLogs: role === "founder" || role === "director",
    canManageAuditLogs: role === "founder",
    canViewSettings: role === "founder" || role === "director",
    canEditSettings: role === "founder",
  };
}

async function requireRole(response, session, roles, handler) {
  if (!roles.includes(session.role)) {
    sendJSON(response, 403, { message: "You do not have access to perform this action." });
    return;
  }
  await handler();
}

async function readJSONBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readCompanyData() {
  const text = await readFile(DATA_PATH, "utf8");
  const data = JSON.parse(text.replace(/^\uFEFF/, ""));
  let changed = false;

  if (!data.documents) {
    data.documents = { categories: [], records: [] };
    changed = true;
  }
  if (!Array.isArray(data.documents.categories)) {
    data.documents.categories = [];
    changed = true;
  }
  if (!Array.isArray(data.documents.records)) {
    data.documents.records = [];
    changed = true;
  }

  if (!data.boardMeetings) {
    data.boardMeetings = { meetingTypes: MEETING_TYPES, statusOptions: MEETING_STATUSES, records: [] };
    changed = true;
  }
  if (!Array.isArray(data.boardMeetings.meetingTypes)) {
    data.boardMeetings.meetingTypes = MEETING_TYPES;
    changed = true;
  }
  if (!Array.isArray(data.boardMeetings.statusOptions)) {
    data.boardMeetings.statusOptions = MEETING_STATUSES;
    changed = true;
  }
  if (!Array.isArray(data.boardMeetings.records)) {
    data.boardMeetings.records = [];
    changed = true;
  }

  if (!data.financials) {
    data.financials = { records: [] };
    changed = true;
  }
  if (!Array.isArray(data.financials.records)) {
    data.financials.records = [];
    changed = true;
  }

  if (!data.compliance) {
    data.compliance = { categories: COMPLIANCE_CATEGORIES, statusOptions: COMPLIANCE_STATUSES, priorityOptions: PRIORITIES, records: [] };
    changed = true;
  }
  if (!Array.isArray(data.compliance.categories)) {
    data.compliance.categories = COMPLIANCE_CATEGORIES;
    changed = true;
  }
  if (!Array.isArray(data.compliance.statusOptions)) {
    data.compliance.statusOptions = COMPLIANCE_STATUSES;
    changed = true;
  }
  if (!Array.isArray(data.compliance.priorityOptions)) {
    data.compliance.priorityOptions = PRIORITIES;
    changed = true;
  }
  if (!Array.isArray(data.compliance.records)) {
    data.compliance.records = [];
    changed = true;
  }

  if (!data.tasks) {
    data.tasks = { categories: TASK_CATEGORIES, statusOptions: TASK_STATUSES, priorityOptions: PRIORITIES, records: [] };
    changed = true;
  }
  if (!Array.isArray(data.tasks.categories)) {
    data.tasks.categories = TASK_CATEGORIES;
    changed = true;
  }
  if (!Array.isArray(data.tasks.statusOptions)) {
    data.tasks.statusOptions = TASK_STATUSES;
    changed = true;
  }
  if (!Array.isArray(data.tasks.priorityOptions)) {
    data.tasks.priorityOptions = PRIORITIES;
    changed = true;
  }
  if (!Array.isArray(data.tasks.records)) {
    data.tasks.records = [];
    changed = true;
  }

  if (!data.products) {
    data.products = { categories: PRODUCT_CATEGORIES, statusOptions: PRODUCT_STATUSES, stageOptions: PRODUCT_STAGES, records: [] };
    changed = true;
  }
  if (!Array.isArray(data.products.categories)) {
    data.products.categories = PRODUCT_CATEGORIES;
    changed = true;
  }
  if (!Array.isArray(data.products.statusOptions)) {
    data.products.statusOptions = PRODUCT_STATUSES;
    changed = true;
  }
  if (!Array.isArray(data.products.stageOptions)) {
    data.products.stageOptions = PRODUCT_STAGES;
    changed = true;
  }
  if (!Array.isArray(data.products.records)) {
    data.products.records = [];
    changed = true;
  }

  if (!data.contacts) {
    data.contacts = { categories: CONTACT_CATEGORIES, statusOptions: CONTACT_STATUSES, records: [] };
    changed = true;
  }
  if (!Array.isArray(data.contacts.categories)) {
    data.contacts.categories = CONTACT_CATEGORIES;
    changed = true;
  }
  if (!Array.isArray(data.contacts.statusOptions)) {
    data.contacts.statusOptions = CONTACT_STATUSES;
    changed = true;
  }
  if (!Array.isArray(data.contacts.records)) {
    data.contacts.records = [];
    changed = true;
  }

  if (!data.ecosystem) {
    data.ecosystem = defaultEcosystemState();
    changed = true;
  }
  const normalizedEcosystem = normalizeEcosystemState(data.ecosystem);
  if (JSON.stringify(normalizedEcosystem) !== JSON.stringify(data.ecosystem)) {
    data.ecosystem = normalizedEcosystem;
    changed = true;
  }
  const postgresEcosystemProducts = await readEcosystemProductsFromPostgres();
  if (Array.isArray(postgresEcosystemProducts)) {
    data.ecosystem.products = postgresEcosystemProducts;
  }

  if (!data.audit) {
    data.audit = { records: [] };
    changed = true;
  }
  if (!Array.isArray(data.audit.records)) {
    data.audit.records = [];
    changed = true;
  }

  if (!data.settings) {
    data.settings = defaultSettings(data);
    changed = true;
  } else {
    const normalizedSettings = normalizeSettings(data.settings, data);
    if (JSON.stringify(normalizedSettings) !== JSON.stringify(data.settings)) {
      data.settings = normalizedSettings;
      changed = true;
    }
  }

  if (changed) {
    await writeCompanyData(data);
  }
  return data;
}

async function writeCompanyData(data) {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function defaultEcosystemState() {
  return {
    statusOptions: ECOSYSTEM_PRODUCT_STATUSES,
    launchStatusOptions: ECOSYSTEM_LAUNCH_STATUSES,
    revenueStatusOptions: ECOSYSTEM_REVENUE_STATUSES,
    complianceStatusOptions: ECOSYSTEM_COMPLIANCE_STATUSES,
    securityStatusOptions: ECOSYSTEM_SECURITY_STATUSES,
    deploymentStatusOptions: ECOSYSTEM_DEPLOYMENT_STATUSES,
    products: [],
  };
}

function normalizeEcosystemState(input) {
  const source = input || {};
  return {
    statusOptions: Array.isArray(source.statusOptions) ? source.statusOptions : ECOSYSTEM_PRODUCT_STATUSES,
    launchStatusOptions: Array.isArray(source.launchStatusOptions) ? source.launchStatusOptions : ECOSYSTEM_LAUNCH_STATUSES,
    revenueStatusOptions: Array.isArray(source.revenueStatusOptions) ? source.revenueStatusOptions : ECOSYSTEM_REVENUE_STATUSES,
    complianceStatusOptions: Array.isArray(source.complianceStatusOptions) ? source.complianceStatusOptions : ECOSYSTEM_COMPLIANCE_STATUSES,
    securityStatusOptions: Array.isArray(source.securityStatusOptions) ? source.securityStatusOptions : ECOSYSTEM_SECURITY_STATUSES,
    deploymentStatusOptions: Array.isArray(source.deploymentStatusOptions) ? source.deploymentStatusOptions : ECOSYSTEM_DEPLOYMENT_STATUSES,
    products: Array.isArray(source.products) ? source.products.map(normalizeEcosystemProduct).filter(Boolean) : [],
  };
}

function normalizeEcosystemProduct(input) {
  if (!input || typeof input !== "object") return null;
  const status = clean(input.status).toUpperCase();
  const product = {
    id: clean(input.id),
    productName: clean(input.productName),
    productCode: clean(input.productCode).toUpperCase(),
    status: ECOSYSTEM_PRODUCT_STATUSES.includes(status) ? status : "",
    owner: clean(input.owner),
    description: clean(input.description),
    domain: clean(input.domain),
    backendUrl: clean(input.backendUrl),
    frontendUrl: clean(input.frontendUrl),
    currentVersion: clean(input.currentVersion),
    launchStatus: normalizeOptionalEnum(input.launchStatus, ECOSYSTEM_LAUNCH_STATUSES),
    revenueStatus: normalizeOptionalEnum(input.revenueStatus, ECOSYSTEM_REVENUE_STATUSES),
    complianceStatus: normalizeOptionalEnum(input.complianceStatus, ECOSYSTEM_COMPLIANCE_STATUSES),
    securityStatus: normalizeOptionalEnum(input.securityStatus, ECOSYSTEM_SECURITY_STATUSES),
    deploymentStatus: normalizeOptionalEnum(input.deploymentStatus, ECOSYSTEM_DEPLOYMENT_STATUSES),
    roadmapItems: cleanArray(input.roadmapItems),
    launchChecklist: cleanArray(input.launchChecklist),
    risks: cleanArray(input.risks),
    archived: Boolean(input.archived) || status === "ARCHIVED",
    createdBy: clean(input.createdBy),
    createdAt: clean(input.createdAt),
    lastUpdated: clean(input.lastUpdated),
  };
  return product.id ? product : null;
}

function normalizeOptionalEnum(value, options) {
  const normalized = clean(value).toUpperCase();
  return options.includes(normalized) ? normalized : "";
}

function buildEcosystemResponse(data, product, message) {
  return {
    message,
    product,
    products: data.ecosystem.products,
    summary: buildEcosystemSummary(data.ecosystem.products),
    persistence: ecosystemPersistenceMode(),
    auditLogs: data.audit.records,
  };
}

function buildEcosystemSummary(products) {
  const records = Array.isArray(products) ? products : [];
  const activeProducts = records.filter((product) => !product.archived && product.status !== "ARCHIVED");
  return {
    registeredProducts: records.length,
    activeProducts: activeProducts.length,
    liveProducts: activeProducts.filter((product) => product.status === "LIVE").length,
    launchReadyProducts: activeProducts.filter((product) => product.status === "LAUNCH_READY" || product.launchStatus === "LAUNCH_READY").length,
    pausedProducts: records.filter((product) => product.status === "PAUSED").length,
    archivedProducts: records.filter((product) => product.archived || product.status === "ARCHIVED").length,
    productsWithOwners: records.filter((product) => Boolean(product.owner)).length,
    revenueVisibleProducts: records.filter((product) => Boolean(product.revenueStatus)).length,
    complianceVisibleProducts: records.filter((product) => Boolean(product.complianceStatus)).length,
    securityVisibleProducts: records.filter((product) => Boolean(product.securityStatus)).length,
    deploymentVisibleProducts: records.filter((product) => Boolean(product.deploymentStatus)).length,
    openRiskItems: records.reduce((total, product) => total + (Array.isArray(product.risks) ? product.risks.length : 0), 0),
    roadmapItems: records.reduce((total, product) => total + (Array.isArray(product.roadmapItems) ? product.roadmapItems.length : 0), 0),
    launchChecklistItems: records.reduce((total, product) => total + (Array.isArray(product.launchChecklist) ? product.launchChecklist.length : 0), 0),
    remainingEcosystemGaps: records.reduce((total, product) => total + ecosystemProductGaps(product).length, 0),
  };
}

function ecosystemProductGaps(product) {
  const gaps = [];
  const requiredFields = [
    ["owner", "Owner"],
    ["domain", "Domain"],
    ["backendUrl", "Backend URL"],
    ["frontendUrl", "Frontend URL"],
    ["currentVersion", "Current version"],
    ["launchStatus", "Launch status"],
    ["revenueStatus", "Revenue status"],
    ["complianceStatus", "Compliance status"],
    ["securityStatus", "Security status"],
    ["deploymentStatus", "Deployment status"],
  ];
  requiredFields.forEach(([key, label]) => {
    if (!clean(product?.[key])) gaps.push(label);
  });
  if (!Array.isArray(product?.roadmapItems) || product.roadmapItems.length === 0) gaps.push("Roadmap");
  if (!Array.isArray(product?.launchChecklist) || product.launchChecklist.length === 0) gaps.push("Launch checklist");
  return gaps;
}

function ecosystemAuditSnapshot(product) {
  return {
    productName: product.productName,
    productCode: product.productCode,
    status: product.status,
    owner: product.owner,
    launchStatus: product.launchStatus,
    revenueStatus: product.revenueStatus,
    complianceStatus: product.complianceStatus,
    securityStatus: product.securityStatus,
    deploymentStatus: product.deploymentStatus,
    lastUpdated: product.lastUpdated,
  };
}

function ecosystemPersistenceMode() {
  return ecosystemPostgresConnectionString() ? "PostgreSQL" : "Local JSON fallback";
}

function ecosystemPostgresConnectionString() {
  return clean(process.env.KRAVIA_ECOSYSTEM_DATABASE_URL || process.env.DATABASE_URL);
}

async function ecosystemPostgresPool() {
  const connectionString = ecosystemPostgresConnectionString();
  if (!connectionString) return null;
  if (!ecosystemPgPoolPromise) {
    ecosystemPgPoolPromise = import("pg")
      .then(async (pg) => {
        const pool = new pg.Pool({ connectionString });
        await ensureEcosystemPostgresSchema(pool);
        return pool;
      })
      .catch((error) => {
        ecosystemPgPoolPromise = null;
        if (process.env.KRAVIA_ECOSYSTEM_REQUIRE_POSTGRES === "true") {
          throw error;
        }
        console.warn(`Ecosystem PostgreSQL unavailable; using local JSON fallback. ${error.message}`);
        return null;
      });
  }
  return ecosystemPgPoolPromise;
}

async function ensureEcosystemPostgresSchema(pool) {
  if (ecosystemPgSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kravia_ecosystem_products (
      id text PRIMARY KEY,
      product_name text NOT NULL,
      product_code text NOT NULL UNIQUE,
      status text NOT NULL,
      owner_name text,
      description text,
      domain text,
      backend_url text,
      frontend_url text,
      current_version text,
      launch_status text,
      revenue_status text,
      compliance_status text,
      security_status text,
      deployment_status text,
      roadmap_items jsonb NOT NULL DEFAULT '[]'::jsonb,
      launch_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
      risks jsonb NOT NULL DEFAULT '[]'::jsonb,
      archived boolean NOT NULL DEFAULT false,
      created_by text,
      created_at timestamptz NOT NULL,
      last_updated timestamptz NOT NULL
    );
  `);
  ecosystemPgSchemaReady = true;
}

async function readEcosystemProductsFromPostgres() {
  const pool = await ecosystemPostgresPool();
  if (!pool) return null;
  const result = await pool.query(`
    SELECT id, product_name, product_code, status, owner_name, description, domain, backend_url, frontend_url,
           current_version, launch_status, revenue_status, compliance_status, security_status, deployment_status,
           roadmap_items, launch_checklist, risks, archived, created_by, created_at, last_updated
    FROM kravia_ecosystem_products
    ORDER BY archived ASC, last_updated DESC, product_name ASC
  `);
  return result.rows.map(pgRowToEcosystemProduct);
}

async function persistEcosystemProduct(product) {
  const pool = await ecosystemPostgresPool();
  if (!pool) return false;
  await pool.query(`
    INSERT INTO kravia_ecosystem_products (
      id, product_name, product_code, status, owner_name, description, domain, backend_url, frontend_url,
      current_version, launch_status, revenue_status, compliance_status, security_status, deployment_status,
      roadmap_items, launch_checklist, risks, archived, created_by, created_at, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20, $21, $22)
    ON CONFLICT (id) DO UPDATE SET
      product_name = EXCLUDED.product_name,
      product_code = EXCLUDED.product_code,
      status = EXCLUDED.status,
      owner_name = EXCLUDED.owner_name,
      description = EXCLUDED.description,
      domain = EXCLUDED.domain,
      backend_url = EXCLUDED.backend_url,
      frontend_url = EXCLUDED.frontend_url,
      current_version = EXCLUDED.current_version,
      launch_status = EXCLUDED.launch_status,
      revenue_status = EXCLUDED.revenue_status,
      compliance_status = EXCLUDED.compliance_status,
      security_status = EXCLUDED.security_status,
      deployment_status = EXCLUDED.deployment_status,
      roadmap_items = EXCLUDED.roadmap_items,
      launch_checklist = EXCLUDED.launch_checklist,
      risks = EXCLUDED.risks,
      archived = EXCLUDED.archived,
      created_by = EXCLUDED.created_by,
      created_at = EXCLUDED.created_at,
      last_updated = EXCLUDED.last_updated
  `, ecosystemProductSqlValues(product));
  return true;
}

function ecosystemProductSqlValues(product) {
  return [
    product.id,
    product.productName,
    product.productCode,
    product.status,
    product.owner,
    product.description,
    product.domain,
    product.backendUrl,
    product.frontendUrl,
    product.currentVersion,
    product.launchStatus,
    product.revenueStatus,
    product.complianceStatus,
    product.securityStatus,
    product.deploymentStatus,
    JSON.stringify(product.roadmapItems || []),
    JSON.stringify(product.launchChecklist || []),
    JSON.stringify(product.risks || []),
    Boolean(product.archived),
    product.createdBy,
    product.createdAt,
    product.lastUpdated,
  ];
}

function pgRowToEcosystemProduct(row) {
  return normalizeEcosystemProduct({
    id: row.id,
    productName: row.product_name,
    productCode: row.product_code,
    status: row.status,
    owner: row.owner_name,
    description: row.description,
    domain: row.domain,
    backendUrl: row.backend_url,
    frontendUrl: row.frontend_url,
    currentVersion: row.current_version,
    launchStatus: row.launch_status,
    revenueStatus: row.revenue_status,
    complianceStatus: row.compliance_status,
    securityStatus: row.security_status,
    deploymentStatus: row.deployment_status,
    roadmapItems: safeJsonArray(row.roadmap_items),
    launchChecklist: safeJsonArray(row.launch_checklist),
    risks: safeJsonArray(row.risks),
    archived: row.archived,
    createdBy: row.created_by,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    lastUpdated: row.last_updated instanceof Date ? row.last_updated.toISOString() : row.last_updated,
  });
}

function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}
function defaultSettings(data) {
  return {
    branding: {
      companyDisplayName: data.company?.name || "KRAVIA PRIVATE LIMITED",
      companyShortName: "",
      logoPlaceholder: "",
      brandColorPlaceholder: "",
      footerText: "",
    },
    security: {
      sessionTimeoutMinutes: Math.round(SESSION_MAX_AGE_SECONDS / 60),
      passwordPolicyPlaceholder: "",
      twoFactorAuthenticationPlaceholder: "",
      protectedRouteStatus: "Enabled",
    },
    notifications: {
      complianceReminders: false,
      taskReminders: false,
      boardMeetingReminders: false,
      financialMonthlyReviewReminders: false,
      emailNotificationPlaceholder: "",
    },
    dataBackup: {
      exportDataPlaceholder: "",
      importDataPlaceholder: "",
      backupStatusPlaceholder: "",
      restorePlaceholder: "",
      lastBackupPlaceholder: "",
    },
    displayPreferences: {
      displayMode: "system",
      compactLayout: false,
      printFriendlyMode: false,
    },
    users: [],
  };
}

function normalizeSettings(input, data) {
  const defaults = defaultSettings(data);
  const source = input || {};
  return {
    branding: {
      companyDisplayName: clean(source.branding?.companyDisplayName) || defaults.branding.companyDisplayName,
      companyShortName: clean(source.branding?.companyShortName),
      logoPlaceholder: clean(source.branding?.logoPlaceholder),
      brandColorPlaceholder: clean(source.branding?.brandColorPlaceholder),
      footerText: clean(source.branding?.footerText),
    },
    security: {
      sessionTimeoutMinutes: Number(source.security?.sessionTimeoutMinutes) || defaults.security.sessionTimeoutMinutes,
      passwordPolicyPlaceholder: clean(source.security?.passwordPolicyPlaceholder),
      twoFactorAuthenticationPlaceholder: clean(source.security?.twoFactorAuthenticationPlaceholder),
      protectedRouteStatus: clean(source.security?.protectedRouteStatus) || defaults.security.protectedRouteStatus,
    },
    notifications: {
      complianceReminders: Boolean(source.notifications?.complianceReminders),
      taskReminders: Boolean(source.notifications?.taskReminders),
      boardMeetingReminders: Boolean(source.notifications?.boardMeetingReminders),
      financialMonthlyReviewReminders: Boolean(source.notifications?.financialMonthlyReviewReminders),
      emailNotificationPlaceholder: clean(source.notifications?.emailNotificationPlaceholder),
    },
    dataBackup: {
      exportDataPlaceholder: clean(source.dataBackup?.exportDataPlaceholder),
      importDataPlaceholder: clean(source.dataBackup?.importDataPlaceholder),
      backupStatusPlaceholder: clean(source.dataBackup?.backupStatusPlaceholder),
      restorePlaceholder: clean(source.dataBackup?.restorePlaceholder),
      lastBackupPlaceholder: clean(source.dataBackup?.lastBackupPlaceholder),
    },
    displayPreferences: {
      displayMode: DISPLAY_MODES.includes(clean(source.displayPreferences?.displayMode)) ? clean(source.displayPreferences.displayMode) : defaults.displayPreferences.displayMode,
      compactLayout: Boolean(source.displayPreferences?.compactLayout),
      printFriendlyMode: Boolean(source.displayPreferences?.printFriendlyMode),
    },
    users: Array.isArray(source.users) ? source.users.map((user) => ({
      name: clean(user.name),
      email: clean(user.email).toLowerCase(),
      role: clean(user.role).toLowerCase(),
      status: clean(user.status),
    })) : [],
  };
}

function buildSettingsPayload(data, session) {
  const settings = normalizeSettings(data.settings, data);
  if (session.role === "director") {
    return {
      branding: settings.branding,
      security: {
        sessionTimeoutMinutes: settings.security.sessionTimeoutMinutes,
        protectedRouteStatus: settings.security.protectedRouteStatus,
      },
      notifications: settings.notifications,
      dataBackup: {
        backupStatusPlaceholder: settings.dataBackup.backupStatusPlaceholder,
        lastBackupPlaceholder: settings.dataBackup.lastBackupPlaceholder,
      },
      displayPreferences: settings.displayPreferences,
    };
  }
  return settings;
}

function buildSettingsUsers(auditRecords) {
  const lastActiveByEmail = new Map();
  auditRecords
    .filter((record) => record.actionType === "Login" && record.userEmail)
    .forEach((record) => {
      if (!lastActiveByEmail.has(record.userEmail)) {
        lastActiveByEmail.set(record.userEmail, record.timestamp);
      }
    });
  return getConfiguredUsers().map((user) => ({
    name: user.name || user.email,
    email: user.email,
    role: user.role,
    status: "Active",
    lastActive: lastActiveByEmail.get(user.email) || "",
  }));
}

function validateSettings(input, existingSettings, data) {
  const merged = {
    ...existingSettings,
    ...input,
    branding: { ...(existingSettings?.branding || {}), ...(input?.branding || {}) },
    security: { ...(existingSettings?.security || {}), ...(input?.security || {}) },
    notifications: { ...(existingSettings?.notifications || {}), ...(input?.notifications || {}) },
    dataBackup: { ...(existingSettings?.dataBackup || {}), ...(input?.dataBackup || {}) },
    displayPreferences: { ...(existingSettings?.displayPreferences || {}), ...(input?.displayPreferences || {}) },
  };
  const settings = normalizeSettings(merged, data);
  const errors = {};
  const rawDisplayName = clean(merged.branding?.companyDisplayName);
  const rawTimeout = clean(merged.security?.sessionTimeoutMinutes);
  const rawDisplayMode = clean(merged.displayPreferences?.displayMode);

  if (!rawDisplayName) {
    errors.companyDisplayName = "Company display name is required.";
  } else {
    settings.branding.companyDisplayName = rawDisplayName;
  }
  if (rawTimeout === "" || !Number.isFinite(Number(rawTimeout)) || Number(rawTimeout) <= 0) {
    errors.sessionTimeoutMinutes = "Session timeout must be a valid number.";
  } else {
    settings.security.sessionTimeoutMinutes = Number(rawTimeout);
  }
  if (!DISPLAY_MODES.includes(rawDisplayMode)) {
    errors.displayMode = "Display mode must be valid.";
  } else {
    settings.displayPreferences.displayMode = rawDisplayMode;
  }
  settings.users.forEach((user, index) => {
    if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      errors[`users.${index}.email`] = "User email must be valid.";
    }
    if (user.role && !ROLES.has(user.role)) {
      errors[`users.${index}.role`] = "Role must be valid.";
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    settings,
  };
}

function recordAuditLog(data, actor, request, entry) {
  if (!data.audit) {
    data.audit = { records: [] };
  }
  if (!Array.isArray(data.audit.records)) {
    data.audit.records = [];
  }

  const actionType = clean(entry.actionType);
  const module = clean(entry.module);
  const user = clean(actor?.name || actor?.email);
  const role = clean(actor?.role);
  if (!actionType || !module || !user || !role) {
    return;
  }

  const severity = AUDIT_SEVERITIES.includes(clean(entry.severity)) ? clean(entry.severity) : "Info";
  data.audit.records.unshift({
    id: makeId("audit"),
    actionType,
    module,
    description: clean(entry.description),
    user,
    userEmail: clean(actor?.email).toLowerCase(),
    role,
    timestamp: new Date().toISOString(),
    previousValuePlaceholder: auditValue(entry.previousValue),
    newValuePlaceholder: auditValue(entry.newValue),
    ipDevicePlaceholder: getRequestContext(request),
    severity,
  });
  data.audit.records = data.audit.records.slice(0, AUDIT_LOG_LIMIT);
}

function auditValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 600 ? `${text.slice(0, 600)}...` : text;
}

function getRequestContext(request) {
  const forwardedFor = clean(request.headers["x-forwarded-for"]);
  const ip = forwardedFor || request.socket?.remoteAddress || "";
  const userAgent = clean(request.headers["user-agent"]);
  return [ip, userAgent].filter(Boolean).join(" | ");
}

function settingsAuditSnapshot(settings) {
  const normalized = normalizeSettings(settings, { company: { name: "KRAVIA PRIVATE LIMITED" } });
  return {
    companyDisplayName: normalized.branding.companyDisplayName,
    sessionTimeoutMinutes: normalized.security.sessionTimeoutMinutes,
    displayMode: normalized.displayPreferences.displayMode,
    compactLayout: normalized.displayPreferences.compactLayout,
    printFriendlyMode: normalized.displayPreferences.printFriendlyMode,
  };
}

function recordLabel(record, fields) {
  for (const field of fields) {
    if (record && record[field]) {
      return record[field];
    }
  }
  return "record";
}

function validateProfile(input) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const profile = {
    companyName: clean(input.companyName),
    cin: clean(input.cin).toUpperCase(),
    pan: clean(input.pan).toUpperCase(),
    tan: clean(input.tan).toUpperCase(),
    registeredOfficeAddress: clean(input.registeredOfficeAddress),
    email: clean(input.email),
    phone: clean(input.phone),
    dateOfIncorporation: clean(input.dateOfIncorporation),
    authorizedCapital: clean(input.authorizedCapital),
    paidUpCapital: clean(input.paidUpCapital),
    directors: cleanArray(input.directors),
    shareholders: cleanArray(input.shareholders),
    companyStatus: clean(input.companyStatus),
    lastUpdatedDate: clean(input.lastUpdatedDate),
  };
  const errors = {};

  if (!profile.companyName) {
    errors.companyName = "Company name is required.";
  }
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (profile.phone && !/^[+()0-9\s-]{7,24}$/.test(profile.phone)) {
    errors.phone = "Enter a valid phone number.";
  }
  if (profile.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(profile.pan)) {
    errors.pan = "Enter a valid PAN format.";
  }
  if (profile.dateOfIncorporation && isFutureDate(profile.dateOfIncorporation, today)) {
    errors.dateOfIncorporation = "Date of incorporation cannot be in the future.";
  }
  if (profile.lastUpdatedDate && isFutureDate(profile.lastUpdatedDate, today)) {
    errors.lastUpdatedDate = "Last updated date cannot be in the future.";
  }

  const authorized = parseMoney(profile.authorizedCapital);
  const paid = parseMoney(profile.paidUpCapital);
  if (authorized !== null && paid !== null && paid > authorized) {
    errors.paidUpCapital = "Paid-up capital cannot exceed authorized capital.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    profile,
  };
}

function validateMeeting(input) {
  const meeting = {
    meetingTitle: clean(input.meetingTitle),
    meetingDate: clean(input.meetingDate),
    meetingType: MEETING_TYPES.includes(clean(input.meetingType)) ? clean(input.meetingType) : "Other",
    attendees: cleanArray(input.attendees),
    agenda: cleanArray(input.agenda),
    discussionNotes: clean(input.discussionNotes),
    decisionsTaken: clean(input.decisionsTaken),
    boardResolutions: clean(input.boardResolutions),
    actionItems: cleanArray(input.actionItems),
    actionOwner: clean(input.actionOwner),
    dueDate: clean(input.dueDate),
    status: MEETING_STATUSES.includes(clean(input.status)) ? clean(input.status) : "Draft",
    nextMeetingDate: clean(input.nextMeetingDate),
    attachmentsPlaceholder: clean(input.attachmentsPlaceholder),
  };
  const errors = {};

  if (!meeting.meetingTitle) {
    errors.meetingTitle = "Meeting title is required.";
  }
  if (!meeting.meetingDate) {
    errors.meetingDate = "Meeting date is required.";
  } else if (!isISODate(meeting.meetingDate)) {
    errors.meetingDate = "Enter a valid meeting date.";
  }
  if (meeting.agenda.length === 0) {
    errors.agenda = "At least one agenda item is required.";
  }
  if (meeting.actionItems.length > 0 && !meeting.actionOwner) {
    errors.actionOwner = "Action owner is required when action items exist.";
  }
  if (meeting.dueDate && !isISODate(meeting.dueDate)) {
    errors.dueDate = "Enter a valid due date.";
  }
  if (meeting.nextMeetingDate && !isISODate(meeting.nextMeetingDate)) {
    errors.nextMeetingDate = "Enter a valid next meeting date.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    meeting,
  };
}

function validateFinancialRecord(input) {
  const errors = {};
  const reportingMonth = clean(input.reportingMonth);
  if (!/^\d{4}-\d{2}$/.test(reportingMonth)) {
    errors.reportingMonth = "Reporting month is required.";
  }

  const revenue = parseRequiredNumber(input.revenue, "revenue", errors);
  const expenses = parseRequiredNumber(input.expenses, "expenses", errors);
  const gstCollected = parseRequiredNumber(input.gstCollected, "gstCollected", errors);
  const gstPaid = parseRequiredNumber(input.gstPaid, "gstPaid", errors);
  const cashBalance = parseOptionalNumber(input.cashBalance, "cashBalance", errors);
  const receivables = parseOptionalNumber(input.receivables, "receivables", errors);
  const payables = parseOptionalNumber(input.payables, "payables", errors);
  const cloudSoftwareSubscriptions = parseOptionalNumber(input.cloudSoftwareSubscriptions, "cloudSoftwareSubscriptions", errors);
  const vendorPayments = parseOptionalNumber(input.vendorPayments, "vendorPayments", errors);
  const directorRemuneration = parseOptionalNumber(input.directorRemuneration, "directorRemuneration", errors);

  const record = {
    reportingMonth,
    revenue: revenue ?? 0,
    expenses: expenses ?? 0,
    profitLoss: roundMoney((revenue ?? 0) - (expenses ?? 0)),
    cashBalance,
    receivables,
    payables,
    gstCollected: gstCollected ?? 0,
    gstPaid: gstPaid ?? 0,
    netGstPosition: roundMoney((gstCollected ?? 0) - (gstPaid ?? 0)),
    cloudSoftwareSubscriptions,
    vendorPayments,
    directorRemuneration,
    founderNotes: clean(input.founderNotes),
  };

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    record,
  };
}

function validateComplianceItem(input) {
  const category = clean(input.category);
  const status = clean(input.status);
  const priority = clean(input.priority) || "Medium";
  const complianceItem = {
    complianceTitle: clean(input.complianceTitle),
    category: COMPLIANCE_CATEGORIES.includes(category) ? category : "",
    description: clean(input.description),
    dueDate: clean(input.dueDate),
    status: COMPLIANCE_STATUSES.includes(status) ? status : "",
    priority: PRIORITIES.includes(priority) ? priority : "Medium",
    responsiblePerson: clean(input.responsiblePerson),
    relatedDocument: clean(input.relatedDocument),
    notes: clean(input.notes),
  };
  const errors = {};

  if (!complianceItem.complianceTitle) {
    errors.complianceTitle = "Compliance title is required.";
  }
  if (!complianceItem.category) {
    errors.category = "Category is required.";
  }
  if (!complianceItem.status) {
    errors.status = "Status is required.";
  }
  if (complianceItem.dueDate && !isISODate(complianceItem.dueDate)) {
    errors.dueDate = "Enter a valid due date.";
  }
  if (complianceItem.status !== "Not Applicable" && !complianceItem.dueDate) {
    errors.dueDate = "Due date is required when compliance is applicable.";
  }
  if (isActiveComplianceStatus(complianceItem.status) && !complianceItem.responsiblePerson) {
    errors.responsiblePerson = "Responsible person is required for active compliance items.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    complianceItem,
  };
}

function validateTask(input) {
  const category = clean(input.category);
  const status = clean(input.status);
  const priority = clean(input.priority) || "Medium";
  const task = {
    taskTitle: clean(input.taskTitle),
    category: TASK_CATEGORIES.includes(category) ? category : "",
    description: clean(input.description),
    assignedTo: clean(input.assignedTo),
    dueDate: clean(input.dueDate),
    priority: PRIORITIES.includes(priority) ? priority : "Medium",
    status: TASK_STATUSES.includes(status) ? status : "",
    relatedSection: clean(input.relatedSection),
    relatedDocument: clean(input.relatedDocument),
    notes: clean(input.notes),
  };
  const errors = {};

  if (!task.taskTitle) {
    errors.taskTitle = "Task title is required.";
  }
  if (!task.category) {
    errors.category = "Category is required.";
  }
  if (!task.status) {
    errors.status = "Status is required.";
  }
  if (task.dueDate && !isISODate(task.dueDate)) {
    errors.dueDate = "Enter a valid due date.";
  }
  if (isActiveTaskStatus(task.status) && !task.assignedTo) {
    errors.assignedTo = "Assigned person is required when task is active.";
  }
  if ((task.priority === "High" || task.priority === "Critical") && !task.dueDate) {
    errors.dueDate = "Due date is required for high or critical priority tasks.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    task,
  };
}

function validateEcosystemProduct(input, existing) {
  const status = clean(input.status).toUpperCase();
  const product = {
    productName: clean(input.productName),
    productCode: clean(input.productCode).toUpperCase(),
    status: ECOSYSTEM_PRODUCT_STATUSES.includes(status) ? status : "",
    owner: clean(input.owner),
    description: clean(input.description),
    domain: clean(input.domain),
    backendUrl: clean(input.backendUrl),
    frontendUrl: clean(input.frontendUrl),
    currentVersion: clean(input.currentVersion),
    launchStatus: normalizeOptionalEnum(input.launchStatus, ECOSYSTEM_LAUNCH_STATUSES),
    revenueStatus: normalizeOptionalEnum(input.revenueStatus, ECOSYSTEM_REVENUE_STATUSES),
    complianceStatus: normalizeOptionalEnum(input.complianceStatus, ECOSYSTEM_COMPLIANCE_STATUSES),
    securityStatus: normalizeOptionalEnum(input.securityStatus, ECOSYSTEM_SECURITY_STATUSES),
    deploymentStatus: normalizeOptionalEnum(input.deploymentStatus, ECOSYSTEM_DEPLOYMENT_STATUSES),
    roadmapItems: cleanArray(input.roadmapItems),
    launchChecklist: cleanArray(input.launchChecklist),
    risks: cleanArray(input.risks),
  };
  const errors = {};

  if (!product.productName) errors.productName = "Product name is required.";
  if (!product.productCode) errors.productCode = "Product code is required.";
  if (product.productCode && !/^[A-Z0-9_-]{2,32}$/.test(product.productCode)) errors.productCode = "Use 2-32 uppercase letters, numbers, hyphens, or underscores.";
  if (!product.status) errors.status = "Status is required.";
  if (!["IDEA", "ARCHIVED"].includes(product.status) && !product.owner) errors.owner = "Owner is required unless the product is only an idea or archived.";
  if (product.domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(product.domain)) errors.domain = "Enter a valid domain.";
  if (product.backendUrl && !isHttpUrl(product.backendUrl)) errors.backendUrl = "Enter a valid backend URL.";
  if (product.frontendUrl && !isHttpUrl(product.frontendUrl)) errors.frontendUrl = "Enter a valid frontend URL.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    product: existing ? { ...product } : product,
  };
}

function validateEcosystemStatusUpdate(input, existing) {
  const status = clean(input.status || existing.status).toUpperCase();
  const statuses = {
    status: ECOSYSTEM_PRODUCT_STATUSES.includes(status) ? status : "",
    launchStatus: normalizeOptionalEnum(input.launchStatus ?? existing.launchStatus, ECOSYSTEM_LAUNCH_STATUSES),
    revenueStatus: normalizeOptionalEnum(input.revenueStatus ?? existing.revenueStatus, ECOSYSTEM_REVENUE_STATUSES),
    complianceStatus: normalizeOptionalEnum(input.complianceStatus ?? existing.complianceStatus, ECOSYSTEM_COMPLIANCE_STATUSES),
    securityStatus: normalizeOptionalEnum(input.securityStatus ?? existing.securityStatus, ECOSYSTEM_SECURITY_STATUSES),
    deploymentStatus: normalizeOptionalEnum(input.deploymentStatus ?? existing.deploymentStatus, ECOSYSTEM_DEPLOYMENT_STATUSES),
  };
  const errors = {};
  if (!statuses.status) errors.status = "Status is required.";
  if (statuses.status === "ARCHIVED" && existing.status !== "ARCHIVED") errors.status = "Only founders can archive ecosystem products.";
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    statuses,
  };
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}
function validateProduct(input) {
  const category = clean(input.category);
  const status = clean(input.currentStatus || input.status);
  const stage = clean(input.developmentStage);
  const readinessValue = clean(input.launchReadiness);
  const readinessNumber = readinessValue === "" ? 0 : Number(readinessValue);
  const product = {
    productName: clean(input.productName),
    category: PRODUCT_CATEGORIES.includes(category) ? category : "",
    description: clean(input.description),
    currentStatus: PRODUCT_STATUSES.includes(status) ? status : "",
    developmentStage: PRODUCT_STAGES.includes(stage) ? stage : "",
    launchReadiness: Number.isFinite(readinessNumber) ? Math.round(readinessNumber) : null,
    targetUsers: clean(input.targetUsers),
    pricingNotes: clean(input.pricingNotes),
    revenueNotes: clean(input.revenueNotes),
    keyFeatures: cleanArray(input.keyFeatures),
    pendingWork: cleanArray(input.pendingWork),
    risks: cleanArray(input.risks),
    nextMilestone: clean(input.nextMilestone),
    responsiblePerson: clean(input.responsiblePerson),
  };
  const errors = {};

  if (!product.productName) {
    errors.productName = "Product name is required.";
  }
  if (!product.category) {
    errors.category = "Category is required.";
  }
  if (!product.currentStatus) {
    errors.currentStatus = "Status is required.";
  }
  if (!product.developmentStage) {
    errors.developmentStage = "Development stage is required.";
  }
  if (product.launchReadiness === null || product.launchReadiness < 0 || product.launchReadiness > 100) {
    errors.launchReadiness = "Launch readiness must be between 0 and 100.";
  }
  if (isActiveProductStatus(product.currentStatus) && !product.responsiblePerson) {
    errors.responsiblePerson = "Responsible person is required if product is active.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    product,
  };
}

function validateContact(input) {
  const category = clean(input.category);
  const status = clean(input.status) || "Active";
  const contact = {
    name: clean(input.name),
    organization: clean(input.organization),
    role: clean(input.role),
    category: CONTACT_CATEGORIES.includes(category) ? category : "",
    phone: clean(input.phone),
    email: clean(input.email).toLowerCase(),
    notes: clean(input.notes),
    relatedDocuments: cleanArray(input.relatedDocuments),
    relatedTasks: cleanArray(input.relatedTasks),
    lastContactedDate: clean(input.lastContactedDate),
    nextFollowUpDate: clean(input.nextFollowUpDate),
    status: CONTACT_STATUSES.includes(status) ? status : "",
  };
  const errors = {};

  if (!contact.name) {
    errors.name = "Name is required.";
  }
  if (!contact.category) {
    errors.category = "Category is required.";
  }
  if (!contact.status) {
    errors.status = "Status is required.";
  }
  if (!contact.phone && !contact.email) {
    errors.contactMethod = "Enter at least one contact method: phone or email.";
  }
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (contact.lastContactedDate && !isISODate(contact.lastContactedDate)) {
    errors.lastContactedDate = "Enter a valid last contacted date.";
  }
  if (contact.nextFollowUpDate && !isISODate(contact.nextFollowUpDate)) {
    errors.nextFollowUpDate = "Enter a valid next follow-up date.";
  }
  if (contact.status === "Follow-up Needed" && !contact.nextFollowUpDate) {
    errors.nextFollowUpDate = "Next follow-up date is required when status is Follow-up Needed.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    contact,
  };
}

function parseRequiredNumber(value, field, errors) {
  const cleaned = clean(value);
  if (cleaned === "") {
    errors[field] = "Enter a valid number.";
    return null;
  }
  const number = Number(cleaned);
  if (!Number.isFinite(number)) {
    errors[field] = "Enter a valid number.";
    return null;
  }
  return roundMoney(number);
}

function parseOptionalNumber(value, field, errors) {
  const cleaned = clean(value);
  if (cleaned === "") {
    return null;
  }
  const number = Number(cleaned);
  if (!Number.isFinite(number)) {
    errors[field] = "Enter a valid number.";
    return null;
  }
  return roundMoney(number);
}

function sortDueDatedRecords(records) {
  records.sort((a, b) => {
    const aClosed = Boolean(a.archived) || a.status === "Archived";
    const bClosed = Boolean(b.archived) || b.status === "Archived";
    if (aClosed !== bClosed) {
      return aClosed ? 1 : -1;
    }
    const aDue = a.dueDate || "9999-12-31";
    const bDue = b.dueDate || "9999-12-31";
    const dueOrder = String(aDue).localeCompare(String(bDue));
    if (dueOrder !== 0) {
      return dueOrder;
    }
    return String(b.lastUpdated || b.createdAt || "").localeCompare(String(a.lastUpdated || a.createdAt || ""));
  });
}

function sortUpdatedRecords(records) {
  records.sort((a, b) => {
    const aClosed = Boolean(a.archived) || a.status === "Archived";
    const bClosed = Boolean(b.archived) || b.status === "Archived";
    if (aClosed !== bClosed) {
      return aClosed ? 1 : -1;
    }
    return String(b.lastUpdated || b.createdAt || "").localeCompare(String(a.lastUpdated || a.createdAt || ""));
  });
}

function sortFinancialRecords(records) {
  records.sort((a, b) => String(b.reportingMonth).localeCompare(String(a.reportingMonth)));
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(5).toString("base64url")}`;
}

async function sendFile(response, absolutePath) {
  const normalizedRoot = normalize(__dirname);
  const normalizedPath = normalize(absolutePath);
  if (!normalizedPath.startsWith(normalizedRoot)) {
    sendJSON(response, 403, { message: "Forbidden." });
    return;
  }

  const extension = extname(normalizedPath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(normalizedPath).pipe(response);
}

function sendJSON(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function redirect(response, location) {
  response.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
  });
  response.end();
}

async function loadEnvFile() {
  const envPath = join(__dirname, ".env");
  try {
    const content = await readFile(envPath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const index = trimmed.indexOf("=");
      if (index === -1) {
        return;
      }
      const key = trimmed.slice(0, index).trim();
      const raw = trimmed.slice(index + 1).trim();
      if (!process.env[key]) {
        process.env[key] = stripQuotes(raw);
      }
    });
  } catch (_error) {
    return;
  }
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => clean(item)).filter(Boolean);
  }
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => clean(item))
    .filter(Boolean);
}

function isActiveProductStatus(status) {
  return Boolean(status) && !CLOSED_PRODUCT_STATUSES.has(status);
}

function isActiveContactStatus(status) {
  return Boolean(status) && !CLOSED_CONTACT_STATUSES.has(status);
}

function isActiveComplianceStatus(status) {
  return Boolean(status) && !CLOSED_COMPLIANCE_STATUSES.has(status);
}

function isActiveTaskStatus(status) {
  return Boolean(status) && !CLOSED_TASK_STATUSES.has(status);
}

function isISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function isFutureDate(value, today) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date > today;
}

function parseMoney(value) {
  if (!value) {
    return null;
  }
  const numeric = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
















