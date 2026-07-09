package com.kravia.companyos.hr;

import com.kravia.companyos.announcement.AnnouncementAudience;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.document.DocumentRepository;
import com.kravia.companyos.hr.HrDto.AttendanceRequest;
import com.kravia.companyos.hr.HrDto.AttendanceResponse;
import com.kravia.companyos.hr.HrDto.CertificationRequest;
import com.kravia.companyos.hr.HrDto.CertificationResponse;
import com.kravia.companyos.hr.HrDto.DepartmentRequest;
import com.kravia.companyos.hr.HrDto.DepartmentResponse;
import com.kravia.companyos.hr.HrDto.DesignationRequest;
import com.kravia.companyos.hr.HrDto.DesignationResponse;
import com.kravia.companyos.hr.HrDto.EmployeeContactRequest;
import com.kravia.companyos.hr.HrDto.EmployeeContactResponse;
import com.kravia.companyos.hr.HrDto.EmployeeRequest;
import com.kravia.companyos.hr.HrDto.EmployeeResponse;
import com.kravia.companyos.hr.HrDto.ExitRequestPayload;
import com.kravia.companyos.hr.HrDto.ExitResponse;
import com.kravia.companyos.hr.HrDto.HolidayRequest;
import com.kravia.companyos.hr.HrDto.HolidayResponse;
import com.kravia.companyos.hr.HrDto.HrMetric;
import com.kravia.companyos.hr.HrDto.HrReportResponse;
import com.kravia.companyos.hr.HrDto.HrSummaryResponse;
import com.kravia.companyos.hr.HrDto.LeaveRequestPayload;
import com.kravia.companyos.hr.HrDto.LeaveResponse;
import com.kravia.companyos.hr.HrDto.PayrollRequest;
import com.kravia.companyos.hr.HrDto.PayrollResponse;
import com.kravia.companyos.hr.HrDto.PerformanceReviewRequest;
import com.kravia.companyos.hr.HrDto.PerformanceReviewResponse;
import com.kravia.companyos.hr.HrDto.TrainingRequest;
import com.kravia.companyos.hr.HrDto.TrainingResponse;
import com.kravia.companyos.hr.HrEnums.AttendanceStatus;
import com.kravia.companyos.hr.HrEnums.EmploymentStatus;
import com.kravia.companyos.hr.HrEnums.ExitStatus;
import com.kravia.companyos.hr.HrEnums.HrReportType;
import com.kravia.companyos.hr.HrEnums.LeaveStatus;
import com.kravia.companyos.hr.HrEnums.PayrollStatus;
import com.kravia.companyos.hr.HrEnums.TrainingStatus;
import com.kravia.companyos.notification.NotificationService;
import com.kravia.companyos.notification.NotificationType;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HrService {
    private static final String MODULE = "HR";
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final DepartmentRepository departments;
    private final DesignationRepository designations;
    private final EmployeeRepository employees;
    private final EmployeeContactRepository contacts;
    private final AttendanceRecordRepository attendanceRecords;
    private final LeaveRequestRepository leaveRequests;
    private final HolidayRecordRepository holidays;
    private final PayrollSummaryRepository payrollSummaries;
    private final PerformanceReviewRepository performanceReviews;
    private final TrainingRecordRepository trainings;
    private final EmployeeCertificationRepository certifications;
    private final ExitRecordRepository exitRecords;
    private final DocumentRepository documents;
    private final PermissionService permissions;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public HrService(
        DepartmentRepository departments,
        DesignationRepository designations,
        EmployeeRepository employees,
        EmployeeContactRepository contacts,
        AttendanceRecordRepository attendanceRecords,
        LeaveRequestRepository leaveRequests,
        HolidayRecordRepository holidays,
        PayrollSummaryRepository payrollSummaries,
        PerformanceReviewRepository performanceReviews,
        TrainingRecordRepository trainings,
        EmployeeCertificationRepository certifications,
        ExitRecordRepository exitRecords,
        DocumentRepository documents,
        PermissionService permissions,
        AuditService auditService,
        NotificationService notificationService
    ) {
        this.departments = departments;
        this.designations = designations;
        this.employees = employees;
        this.contacts = contacts;
        this.attendanceRecords = attendanceRecords;
        this.leaveRequests = leaveRequests;
        this.holidays = holidays;
        this.payrollSummaries = payrollSummaries;
        this.performanceReviews = performanceReviews;
        this.trainings = trainings;
        this.certifications = certifications;
        this.exitRecords = exitRecords;
        this.documents = documents;
        this.permissions = permissions;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public HrSummaryResponse summary(AppUser actor) {
        requireViewer(actor);
        LocalDate today = LocalDate.now();
        long activeEmployees = employees.findAll().stream().filter(employee -> employee.getArchivedAt() == null && employee.getEmploymentStatus() == EmploymentStatus.ACTIVE).count();
        long departmentCount = departments.findAll().stream().filter(department -> department.getArchivedAt() == null && department.getStatus() != EmploymentStatus.ARCHIVED).count();
        long pendingLeaves = leaveRequests.findAll().stream().filter(leave -> leave.getArchivedAt() == null && (leave.getStatus() == LeaveStatus.REQUESTED || leave.getStatus() == LeaveStatus.MANAGER_REVIEW)).count();
        long todayAttendance = attendanceRecords.findAll().stream().filter(record -> record.getArchivedAt() == null && today.equals(record.getAttendanceDate())).count();
        long payrollCount = payrollSummaries.findAll().stream().filter(payroll -> payroll.getArchivedAt() == null && payroll.getStatus() != PayrollStatus.ARCHIVED).count();
        long openExitRecords = exitRecords.findAll().stream().filter(exit -> exit.getArchivedAt() == null && exit.getStatus() != ExitStatus.COMPLETED && exit.getStatus() != ExitStatus.CANCELLED && exit.getStatus() != ExitStatus.ARCHIVED).count();
        List<HrMetric> metrics = List.of(
            new HrMetric("Active employees", activeEmployees, "neutral"),
            new HrMetric("Departments", departmentCount, "neutral"),
            new HrMetric("Pending leave requests", pendingLeaves, pendingLeaves == 0 ? "positive" : "warning"),
            new HrMetric("Today attendance records", todayAttendance, "neutral"),
            new HrMetric("Payroll summaries", payrollCount, "neutral"),
            new HrMetric("Open exit records", openExitRecords, openExitRecords == 0 ? "positive" : "warning")
        );
        return new HrSummaryResponse(activeEmployees, departmentCount, pendingLeaves, todayAttendance, payrollCount, openExitRecords, metrics);
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> departments(String query, AppUser actor) {
        requireViewer(actor);
        return departments.findAllByOrderByDepartmentNameAsc().stream().filter(item -> matches(query, item.getDepartmentName(), item.getDescription())).map(this::toDepartmentResponse).toList();
    }

    @Transactional
    public DepartmentResponse saveDepartment(UUID id, DepartmentRequest request, AppUser actor) {
        requireEditor(actor);
        Department department = id == null ? new Department() : findDepartment(id);
        if (id == null && departments.existsByDepartmentNameIgnoreCase(required(request.departmentName(), "Department name"))) throw new IllegalArgumentException("Department already exists.");
        department.setDepartmentName(required(request.departmentName(), "Department name"));
        department.setDescription(blankToNull(request.description()));
        department.setParentDepartment(request.parentDepartmentId() == null ? null : findDepartment(request.parentDepartmentId()));
        department.setOrganizationLevel(request.organizationLevel());
        department.setHeadEmployeeId(request.headEmployeeId());
        department.setStatus(required(request.status(), "Status"));
        if (department.getCreatedBy() == null) department.setCreatedBy(actor.getEmail());
        Department saved = departments.save(department);
        audit(actor, id == null ? "DEPARTMENT_CREATED" : "DEPARTMENT_UPDATED", "Saved department " + saved.getDepartmentName(), "IMPORTANT");
        return toDepartmentResponse(saved);
    }

    @Transactional
    public void archiveDepartment(UUID id, AppUser actor) {
        requireFounder(actor);
        Department department = findDepartment(id);
        department.setStatus(EmploymentStatus.ARCHIVED);
        department.setArchivedAt(Instant.now());
        departments.save(department);
        audit(actor, "DEPARTMENT_ARCHIVED", "Archived department " + department.getDepartmentName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<DesignationResponse> designations(String query, AppUser actor) {
        requireViewer(actor);
        return designations.findAllByOrderByTitleAsc().stream().filter(item -> matches(query, item.getTitle(), deptName(item.getDepartment()), item.getDescription())).map(this::toDesignationResponse).toList();
    }

    @Transactional
    public DesignationResponse saveDesignation(UUID id, DesignationRequest request, AppUser actor) {
        requireEditor(actor);
        Designation designation = id == null ? new Designation() : findDesignation(id);
        designation.setTitle(required(request.title(), "Designation title"));
        designation.setDepartment(request.departmentId() == null ? null : findDepartment(request.departmentId()));
        designation.setOrganizationLevel(required(request.organizationLevel(), "Organization level"));
        designation.setDescription(blankToNull(request.description()));
        designation.setStatus(required(request.status(), "Status"));
        if (designation.getCreatedBy() == null) designation.setCreatedBy(actor.getEmail());
        Designation saved = designations.save(designation);
        audit(actor, id == null ? "DESIGNATION_CREATED" : "DESIGNATION_UPDATED", "Saved designation " + saved.getTitle(), "IMPORTANT");
        return toDesignationResponse(saved);
    }

    @Transactional
    public void archiveDesignation(UUID id, AppUser actor) {
        requireFounder(actor);
        Designation designation = findDesignation(id);
        designation.setStatus(EmploymentStatus.ARCHIVED);
        designation.setArchivedAt(Instant.now());
        designations.save(designation);
        audit(actor, "DESIGNATION_ARCHIVED", "Archived designation " + designation.getTitle(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> employees(String query, EmploymentStatus status, AppUser actor) {
        requireViewer(actor);
        return employees.findAllByOrderByFullNameAsc().stream()
            .filter(employee -> status == null || employee.getEmploymentStatus() == status)
            .filter(employee -> matches(query, employee.getEmployeeId(), employee.getFullName(), employee.getPreferredName(), employee.getEmail(), deptName(employee.getDepartment()), title(employee.getDesignation())))
            .map(this::toEmployeeResponse)
            .toList();
    }

    @Transactional
    public EmployeeResponse saveEmployee(UUID id, EmployeeRequest request, AppUser actor) {
        requireEditor(actor);
        Employee employee = id == null ? new Employee() : findEmployee(id);
        if (id != null && isExited(employee) && !actor.hasRole(Role.FOUNDER)) throw new IllegalArgumentException("Exited employee records require Founder authorization.");
        if (id == null && employees.existsByEmployeeIdIgnoreCase(required(request.employeeId(), "Employee ID"))) throw new IllegalArgumentException("Employee ID already exists.");
        if (id == null && employees.existsByEmailIgnoreCase(required(request.email(), "Email"))) throw new IllegalArgumentException("Employee email already exists.");
        employee.setEmployeeId(required(request.employeeId(), "Employee ID"));
        employee.setFullName(required(request.fullName(), "Full name"));
        employee.setPreferredName(blankToNull(request.preferredName()));
        employee.setProfilePhoto(findDocument(request.profilePhotoDocumentId()));
        employee.setEmail(requiredEmail(request.email()));
        employee.setPhone(blankToNull(request.phone()));
        employee.setEmergencyContact(blankToNull(request.emergencyContact()));
        employee.setDepartment(request.departmentId() == null ? null : findDepartment(request.departmentId()));
        employee.setDesignation(request.designationId() == null ? null : findDesignation(request.designationId()));
        employee.setReportingManager(request.reportingManagerId() == null ? null : findEmployee(request.reportingManagerId()));
        employee.setEmploymentType(required(request.employmentType(), "Employment type"));
        employee.setDateOfJoining(request.dateOfJoining());
        employee.setProbationStatus(request.probationStatus());
        employee.setWorkLocation(blankToNull(request.workLocation()));
        employee.setEmploymentStatus(required(request.employmentStatus(), "Employment status"));
        employee.setSkills(blankToNull(request.skills()));
        employee.setCertifications(blankToNull(request.certifications()));
        employee.setRelatedDocument(findDocument(request.relatedDocumentId()));
        employee.setNotes(blankToNull(request.notes()));
        if (employee.getCreatedBy() == null) employee.setCreatedBy(actor.getEmail());
        Employee saved = employees.save(employee);
        audit(actor, id == null ? "EMPLOYEE_CREATED" : "EMPLOYEE_UPDATED", "Saved employee " + saved.getEmployeeId(), "IMPORTANT");
        return toEmployeeResponse(saved);
    }

    @Transactional
    public void archiveEmployee(UUID id, AppUser actor) {
        requireFounder(actor);
        Employee employee = findEmployee(id);
        employee.setEmploymentStatus(EmploymentStatus.ARCHIVED);
        employee.setArchivedAt(Instant.now());
        employees.save(employee);
        audit(actor, "EMPLOYEE_ARCHIVED", "Archived employee " + employee.getEmployeeId(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<EmployeeContactResponse> contacts(String query, AppUser actor) {
        requireViewer(actor);
        return contacts.findAllByOrderByCreatedAtDesc().stream().filter(item -> matches(query, item.getContactName(), item.getPhone(), item.getEmail(), empName(item.getEmployee()))).map(this::toContactResponse).toList();
    }

    @Transactional
    public EmployeeContactResponse saveContact(UUID id, EmployeeContactRequest request, AppUser actor) {
        requireEditor(actor);
        EmployeeContact contact = id == null ? new EmployeeContact() : findContact(id);
        contact.setEmployee(findEmployee(required(request.employeeId(), "Employee")));
        contact.setContactType(required(request.contactType(), "Contact type"));
        contact.setContactName(required(request.contactName(), "Contact name"));
        contact.setRelationship(blankToNull(request.relationship()));
        contact.setPhone(blankToNull(request.phone()));
        contact.setEmail(blankToNull(request.email()));
        contact.setNotes(blankToNull(request.notes()));
        if (contact.getCreatedBy() == null) contact.setCreatedBy(actor.getEmail());
        EmployeeContact saved = contacts.save(contact);
        audit(actor, id == null ? "EMPLOYEE_CONTACT_CREATED" : "EMPLOYEE_CONTACT_UPDATED", "Saved employee contact " + saved.getContactName(), "IMPORTANT");
        return toContactResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> attendance(String query, AttendanceStatus status, AppUser actor) {
        requireViewer(actor);
        return attendanceRecords.findAllByOrderByAttendanceDateDescCreatedAtDesc().stream()
            .filter(item -> status == null || item.getStatus() == status)
            .filter(item -> matches(query, empName(item.getEmployee()), item.getWorkLocation(), item.getNotes()))
            .map(this::toAttendanceResponse)
            .toList();
    }

    @Transactional
    public AttendanceResponse saveAttendance(UUID id, AttendanceRequest request, AppUser actor) {
        requireEditor(actor);
        AttendanceRecord record = id == null ? new AttendanceRecord() : findAttendance(id);
        record.setEmployee(findEmployee(required(request.employeeId(), "Employee")));
        record.setAttendanceDate(required(request.attendanceDate(), "Attendance date"));
        record.setStatus(required(request.status(), "Attendance status"));
        record.setWorkLocation(blankToNull(request.workLocation()));
        record.setNotes(blankToNull(request.notes()));
        if (record.getCreatedBy() == null) record.setCreatedBy(actor.getEmail());
        AttendanceRecord saved = attendanceRecords.save(record);
        audit(actor, id == null ? "ATTENDANCE_CREATED" : "ATTENDANCE_UPDATED", "Saved attendance for " + empName(saved.getEmployee()), "IMPORTANT");
        return toAttendanceResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<LeaveResponse> leaves(String query, LeaveStatus status, AppUser actor) {
        requireViewer(actor);
        return leaveRequests.findAllByOrderByStartDateDescCreatedAtDesc().stream()
            .filter(item -> status == null || item.getStatus() == status)
            .filter(item -> matches(query, empName(item.getEmployee()), empName(item.getManager()), item.getApprovalNotes()))
            .map(this::toLeaveResponse)
            .toList();
    }

    @Transactional
    public LeaveResponse saveLeave(UUID id, LeaveRequestPayload request, AppUser actor) {
        requireEditor(actor);
        LeaveRequest leave = id == null ? new LeaveRequest() : findLeave(id);
        LeaveStatus previous = leave.getStatus();
        leave.setEmployee(findEmployee(required(request.employeeId(), "Employee")));
        leave.setLeaveType(required(request.leaveType(), "Leave type"));
        leave.setStartDate(required(request.startDate(), "Start date"));
        leave.setEndDate(required(request.endDate(), "End date"));
        if (leave.getEndDate().isBefore(leave.getStartDate())) throw new IllegalArgumentException("Leave end date cannot be before start date.");
        leave.setTotalDays(money(required(request.totalDays(), "Total days")));
        leave.setStatus(required(request.status(), "Leave status"));
        leave.setManager(request.managerId() == null ? null : findEmployee(request.managerId()));
        leave.setApprovalNotes(blankToNull(request.approvalNotes()));
        leave.setRelatedTaskId(request.relatedTaskId());
        if (leave.getCreatedBy() == null) leave.setCreatedBy(actor.getEmail());
        LeaveRequest saved = leaveRequests.save(leave);
        audit(actor, id == null ? "LEAVE_REQUEST_CREATED" : "LEAVE_REQUEST_UPDATED", "Saved leave request for " + empName(saved.getEmployee()), "IMPORTANT");
        if (previous != saved.getStatus()) {
            notificationService.createForAudience(AnnouncementAudience.DIRECTOR, NotificationType.GENERAL, "Leave request updated", empName(saved.getEmployee()) + " leave status is " + saved.getStatus(), MODULE, saved.getId(), actor);
        }
        return toLeaveResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<HolidayResponse> holidays(String query, AppUser actor) {
        requireViewer(actor);
        return holidays.findAllByOrderByHolidayDateAscCreatedAtDesc().stream().filter(item -> matches(query, item.getHolidayName(), item.getDescription())).map(this::toHolidayResponse).toList();
    }

    @Transactional
    public HolidayResponse saveHoliday(UUID id, HolidayRequest request, AppUser actor) {
        requireEditor(actor);
        HolidayRecord holiday = id == null ? new HolidayRecord() : findHoliday(id);
        holiday.setHolidayName(required(request.holidayName(), "Holiday name"));
        holiday.setHolidayDate(required(request.holidayDate(), "Holiday date"));
        holiday.setDescription(blankToNull(request.description()));
        holiday.setStatus(required(request.status(), "Status"));
        if (holiday.getCreatedBy() == null) holiday.setCreatedBy(actor.getEmail());
        HolidayRecord saved = holidays.save(holiday);
        audit(actor, id == null ? "HOLIDAY_CREATED" : "HOLIDAY_UPDATED", "Saved holiday " + saved.getHolidayName(), "IMPORTANT");
        return toHolidayResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PayrollResponse> payroll(String query, PayrollStatus status, AppUser actor) {
        requireViewer(actor);
        return payrollSummaries.findAllByOrderByPayrollMonthDescCreatedAtDesc().stream()
            .filter(item -> status == null || item.getStatus() == status)
            .filter(item -> matches(query, empName(item.getEmployee()), item.getPayrollMonth(), item.getSalaryStructure()))
            .map(this::toPayrollResponse)
            .toList();
    }

    @Transactional
    public PayrollResponse savePayroll(UUID id, PayrollRequest request, AppUser actor) {
        requireEditor(actor);
        PayrollSummary payroll = id == null ? new PayrollSummary() : findPayroll(id);
        payroll.setEmployee(findEmployee(required(request.employeeId(), "Employee")));
        payroll.setPayrollMonth(required(request.payrollMonth(), "Payroll month"));
        payroll.setSalaryStructure(blankToNull(request.salaryStructure()));
        payroll.setBasicSalary(money(request.basicSalary()));
        payroll.setAllowances(money(request.allowances()));
        payroll.setDeductions(money(request.deductions()));
        payroll.setPf(money(request.pf()));
        payroll.setEsi(money(request.esi()));
        payroll.setProfessionalTax(money(request.professionalTax()));
        payroll.setTds(money(request.tds()));
        payroll.setNetSalary(payroll.getBasicSalary().add(payroll.getAllowances()).subtract(payroll.getDeductions()).subtract(payroll.getPf()).subtract(payroll.getEsi()).subtract(payroll.getProfessionalTax()).subtract(payroll.getTds()));
        payroll.setStatus(required(request.status(), "Payroll status"));
        payroll.setLinkedFinancialRecordId(request.linkedFinancialRecordId());
        payroll.setNotes(blankToNull(request.notes()));
        if (payroll.getCreatedBy() == null) payroll.setCreatedBy(actor.getEmail());
        PayrollSummary saved = payrollSummaries.save(payroll);
        audit(actor, id == null ? "PAYROLL_SUMMARY_CREATED" : "PAYROLL_SUMMARY_UPDATED", "Saved payroll summary for " + empName(saved.getEmployee()), "IMPORTANT");
        return toPayrollResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PerformanceReviewResponse> performance(String query, AppUser actor) {
        requireViewer(actor);
        return performanceReviews.findAllByOrderByReviewDateDescCreatedAtDesc().stream().filter(item -> matches(query, empName(item.getEmployee()), item.getReviewCycle(), item.getGoals(), item.getManagerFeedback())).map(this::toPerformanceResponse).toList();
    }

    @Transactional
    public PerformanceReviewResponse savePerformance(UUID id, PerformanceReviewRequest request, AppUser actor) {
        requireEditor(actor);
        PerformanceReview review = id == null ? new PerformanceReview() : findPerformance(id);
        review.setEmployee(findEmployee(required(request.employeeId(), "Employee")));
        review.setReviewCycle(required(request.reviewCycle(), "Review cycle"));
        review.setGoals(blankToNull(request.goals()));
        review.setAchievements(blankToNull(request.achievements()));
        review.setManagerFeedback(blankToNull(request.managerFeedback()));
        review.setEmployeeFeedback(blankToNull(request.employeeFeedback()));
        review.setRating(required(request.rating(), "Rating"));
        review.setImprovementPlan(blankToNull(request.improvementPlan()));
        review.setReviewDate(request.reviewDate());
        review.setReviewer(request.reviewerId() == null ? null : findEmployee(request.reviewerId()));
        review.setRelatedTaskId(request.relatedTaskId());
        review.setStatus(required(request.status(), "Status"));
        if (review.getCreatedBy() == null) review.setCreatedBy(actor.getEmail());
        PerformanceReview saved = performanceReviews.save(review);
        audit(actor, id == null ? "PERFORMANCE_REVIEW_CREATED" : "PERFORMANCE_REVIEW_UPDATED", "Saved performance review for " + empName(saved.getEmployee()), "IMPORTANT");
        return toPerformanceResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<TrainingResponse> trainings(String query, TrainingStatus status, AppUser actor) {
        requireViewer(actor);
        return trainings.findAllByOrderByExpiryDateAscCreatedAtDesc().stream().filter(item -> status == null || item.getStatus() == status).filter(item -> matches(query, item.getTrainingName(), item.getProvider(), item.getSkillsCovered())).map(this::toTrainingResponse).toList();
    }

    @Transactional
    public TrainingResponse saveTraining(UUID id, TrainingRequest request, AppUser actor) {
        requireEditor(actor);
        TrainingRecord training = id == null ? new TrainingRecord() : findTraining(id);
        training.setTrainingName(required(request.trainingName(), "Training name"));
        training.setProvider(blankToNull(request.provider()));
        training.setCompletionDate(request.completionDate());
        training.setExpiryDate(request.expiryDate());
        training.setCertificateDocument(findDocument(request.certificateDocumentId()));
        training.setSkillsCovered(blankToNull(request.skillsCovered()));
        training.setStatus(required(request.status(), "Training status"));
        training.setNotes(blankToNull(request.notes()));
        if (training.getCreatedBy() == null) training.setCreatedBy(actor.getEmail());
        TrainingRecord saved = trainings.save(training);
        audit(actor, id == null ? "TRAINING_CREATED" : "TRAINING_UPDATED", "Saved training " + saved.getTrainingName(), "IMPORTANT");
        return toTrainingResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<CertificationResponse> certifications(String query, TrainingStatus status, AppUser actor) {
        requireViewer(actor);
        return certifications.findAllByOrderByExpiryDateAscCreatedAtDesc().stream().filter(item -> status == null || item.getStatus() == status).filter(item -> matches(query, item.getCertificationName(), item.getProvider(), empName(item.getEmployee()))).map(this::toCertificationResponse).toList();
    }

    @Transactional
    public CertificationResponse saveCertification(UUID id, CertificationRequest request, AppUser actor) {
        requireEditor(actor);
        EmployeeCertification certification = id == null ? new EmployeeCertification() : findCertification(id);
        certification.setEmployee(findEmployee(required(request.employeeId(), "Employee")));
        certification.setTraining(request.trainingId() == null ? null : findTraining(request.trainingId()));
        certification.setCertificationName(required(request.certificationName(), "Certification name"));
        certification.setProvider(blankToNull(request.provider()));
        certification.setIssueDate(request.issueDate());
        certification.setExpiryDate(request.expiryDate());
        certification.setCertificateDocument(findDocument(request.certificateDocumentId()));
        certification.setSkillsCovered(blankToNull(request.skillsCovered()));
        certification.setStatus(required(request.status(), "Certification status"));
        if (certification.getCreatedBy() == null) certification.setCreatedBy(actor.getEmail());
        EmployeeCertification saved = certifications.save(certification);
        audit(actor, id == null ? "EMPLOYEE_CERTIFICATION_CREATED" : "EMPLOYEE_CERTIFICATION_UPDATED", "Saved certification " + saved.getCertificationName(), "IMPORTANT");
        return toCertificationResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ExitResponse> exits(String query, ExitStatus status, AppUser actor) {
        requireViewer(actor);
        return exitRecords.findAllByOrderByLastWorkingDayDescCreatedAtDesc().stream().filter(item -> status == null || item.getStatus() == status).filter(item -> matches(query, empName(item.getEmployee()), item.getReason(), item.getExitChecklist())).map(this::toExitResponse).toList();
    }

    @Transactional
    public ExitResponse saveExit(UUID id, ExitRequestPayload request, AppUser actor) {
        requireEditor(actor);
        ExitRecord exit = id == null ? new ExitRecord() : findExit(id);
        exit.setEmployee(findEmployee(required(request.employeeId(), "Employee")));
        exit.setResignationDate(request.resignationDate());
        exit.setLastWorkingDay(request.lastWorkingDay());
        exit.setReason(blankToNull(request.reason()));
        exit.setExitChecklist(blankToNull(request.exitChecklist()));
        exit.setAssetReturnStatus(blankToNull(request.assetReturnStatus()));
        exit.setFinalSettlementStatus(blankToNull(request.finalSettlementStatus()));
        exit.setKnowledgeTransferStatus(blankToNull(request.knowledgeTransferStatus()));
        exit.setExitInterviewNotes(blankToNull(request.exitInterviewNotes()));
        exit.setRelatedDocument(findDocument(request.relatedDocumentId()));
        exit.setStatus(required(request.status(), "Exit status"));
        if (exit.getCreatedBy() == null) exit.setCreatedBy(actor.getEmail());
        ExitRecord saved = exitRecords.save(exit);
        if (saved.getStatus() == ExitStatus.COMPLETED) {
            Employee employee = saved.getEmployee();
            employee.setEmploymentStatus(EmploymentStatus.RESIGNED);
            employees.save(employee);
        }
        audit(actor, id == null ? "EXIT_RECORD_CREATED" : "EXIT_RECORD_UPDATED", "Saved exit record for " + empName(saved.getEmployee()), "IMPORTANT");
        return toExitResponse(saved);
    }

    @Transactional
    public void archive(UUID id, String type, AppUser actor) {
        requireFounder(actor);
        Instant now = Instant.now();
        switch (type) {
            case "contact" -> findContact(id).setArchivedAt(now);
            case "attendance" -> findAttendance(id).setArchivedAt(now);
            case "leave" -> { LeaveRequest item = findLeave(id); item.setStatus(LeaveStatus.ARCHIVED); item.setArchivedAt(now); }
            case "holiday" -> { HolidayRecord item = findHoliday(id); item.setStatus(EmploymentStatus.ARCHIVED); item.setArchivedAt(now); }
            case "payroll" -> { PayrollSummary item = findPayroll(id); item.setStatus(PayrollStatus.ARCHIVED); item.setArchivedAt(now); }
            case "performance" -> { PerformanceReview item = findPerformance(id); item.setStatus(EmploymentStatus.ARCHIVED); item.setArchivedAt(now); }
            case "training" -> { TrainingRecord item = findTraining(id); item.setStatus(TrainingStatus.ARCHIVED); item.setArchivedAt(now); }
            case "certification" -> { EmployeeCertification item = findCertification(id); item.setStatus(TrainingStatus.ARCHIVED); item.setArchivedAt(now); }
            case "exit" -> { ExitRecord item = findExit(id); item.setStatus(ExitStatus.ARCHIVED); item.setArchivedAt(now); }
            default -> throw new NotFoundException("HR record type not found.");
        }
        audit(actor, "HR_RECORD_ARCHIVED", "Archived HR " + type + " record " + id, "WARNING");
    }

    @Transactional(readOnly = true)
    public HrReportResponse report(HrReportType type, AppUser actor) {
        requireViewer(actor);
        HrSummaryResponse summary = summary(actor);
        List<HrMetric> metrics = switch (type) {
            case EMPLOYEE_DIRECTORY -> List.of(new HrMetric("Active employees", summary.activeEmployees(), "neutral"));
            case DEPARTMENT_SUMMARY -> List.of(new HrMetric("Departments", summary.departments(), "neutral"));
            case LEAVE_REPORT -> List.of(new HrMetric("Pending leave requests", summary.pendingLeaveRequests(), "warning"));
            case ATTENDANCE_REPORT -> List.of(new HrMetric("Today attendance records", summary.todayAttendanceRecords(), "neutral"));
            case PAYROLL_SUMMARY -> List.of(new HrMetric("Payroll summaries", summary.payrollRecords(), "neutral"));
            case PERFORMANCE_REPORT -> List.of(new HrMetric("Performance reviews", performanceReviews.count(), "neutral"));
            case TRAINING_REPORT -> List.of(new HrMetric("Training records", trainings.count() + certifications.count(), "neutral"));
            case EXIT_REPORT -> List.of(new HrMetric("Open exit records", summary.openExitRecords(), "warning"));
        };
        audit(actor, "HR_REPORT_GENERATED", "Generated HR report " + type, "INFO");
        return new HrReportResponse(type, Instant.now(), metrics, metrics.isEmpty() ? List.of("No information has been added yet.") : List.of());
    }

    private DepartmentResponse toDepartmentResponse(Department item) { return new DepartmentResponse(item.getId(), item.getDepartmentName(), item.getDescription(), id(item.getParentDepartment()), deptName(item.getParentDepartment()), item.getOrganizationLevel(), item.getHeadEmployeeId(), item.getStatus(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private DesignationResponse toDesignationResponse(Designation item) { return new DesignationResponse(item.getId(), item.getTitle(), id(item.getDepartment()), deptName(item.getDepartment()), item.getOrganizationLevel(), item.getDescription(), item.getStatus(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private EmployeeResponse toEmployeeResponse(Employee item) { return new EmployeeResponse(item.getId(), item.getEmployeeId(), item.getFullName(), item.getPreferredName(), id(item.getProfilePhoto()), docTitle(item.getProfilePhoto()), item.getEmail(), item.getPhone(), item.getEmergencyContact(), id(item.getDepartment()), deptName(item.getDepartment()), id(item.getDesignation()), title(item.getDesignation()), id(item.getReportingManager()), empName(item.getReportingManager()), item.getEmploymentType(), item.getDateOfJoining(), item.getProbationStatus(), item.getWorkLocation(), item.getEmploymentStatus(), item.getSkills(), item.getCertifications(), id(item.getRelatedDocument()), docTitle(item.getRelatedDocument()), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private EmployeeContactResponse toContactResponse(EmployeeContact item) { return new EmployeeContactResponse(item.getId(), id(item.getEmployee()), empName(item.getEmployee()), item.getContactType(), item.getContactName(), item.getRelationship(), item.getPhone(), item.getEmail(), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private AttendanceResponse toAttendanceResponse(AttendanceRecord item) { return new AttendanceResponse(item.getId(), id(item.getEmployee()), empName(item.getEmployee()), item.getAttendanceDate(), item.getStatus(), item.getWorkLocation(), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private LeaveResponse toLeaveResponse(LeaveRequest item) { return new LeaveResponse(item.getId(), id(item.getEmployee()), empName(item.getEmployee()), item.getLeaveType(), item.getStartDate(), item.getEndDate(), item.getTotalDays(), item.getStatus(), id(item.getManager()), empName(item.getManager()), item.getApprovalNotes(), item.getRelatedTaskId(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private HolidayResponse toHolidayResponse(HolidayRecord item) { return new HolidayResponse(item.getId(), item.getHolidayName(), item.getHolidayDate(), item.getDescription(), item.getStatus(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private PayrollResponse toPayrollResponse(PayrollSummary item) { return new PayrollResponse(item.getId(), id(item.getEmployee()), empName(item.getEmployee()), item.getPayrollMonth(), item.getSalaryStructure(), item.getBasicSalary(), item.getAllowances(), item.getDeductions(), item.getPf(), item.getEsi(), item.getProfessionalTax(), item.getTds(), item.getNetSalary(), item.getStatus(), item.getLinkedFinancialRecordId(), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private PerformanceReviewResponse toPerformanceResponse(PerformanceReview item) { return new PerformanceReviewResponse(item.getId(), id(item.getEmployee()), empName(item.getEmployee()), item.getReviewCycle(), item.getGoals(), item.getAchievements(), item.getManagerFeedback(), item.getEmployeeFeedback(), item.getRating(), item.getImprovementPlan(), item.getReviewDate(), id(item.getReviewer()), empName(item.getReviewer()), item.getRelatedTaskId(), item.getStatus(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private TrainingResponse toTrainingResponse(TrainingRecord item) { return new TrainingResponse(item.getId(), item.getTrainingName(), item.getProvider(), item.getCompletionDate(), item.getExpiryDate(), id(item.getCertificateDocument()), docTitle(item.getCertificateDocument()), item.getSkillsCovered(), item.getStatus(), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private CertificationResponse toCertificationResponse(EmployeeCertification item) { return new CertificationResponse(item.getId(), id(item.getEmployee()), empName(item.getEmployee()), id(item.getTraining()), item.getTraining() == null ? null : item.getTraining().getTrainingName(), item.getCertificationName(), item.getProvider(), item.getIssueDate(), item.getExpiryDate(), id(item.getCertificateDocument()), docTitle(item.getCertificateDocument()), item.getSkillsCovered(), item.getStatus(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }
    private ExitResponse toExitResponse(ExitRecord item) { return new ExitResponse(item.getId(), id(item.getEmployee()), empName(item.getEmployee()), item.getResignationDate(), item.getLastWorkingDay(), item.getReason(), item.getExitChecklist(), item.getAssetReturnStatus(), item.getFinalSettlementStatus(), item.getKnowledgeTransferStatus(), item.getExitInterviewNotes(), id(item.getRelatedDocument()), docTitle(item.getRelatedDocument()), item.getStatus(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt()); }

    private Department findDepartment(UUID id) { return departments.findById(id).orElseThrow(() -> new NotFoundException("Department not found.")); }
    private Designation findDesignation(UUID id) { return designations.findById(id).orElseThrow(() -> new NotFoundException("Designation not found.")); }
    private Employee findEmployee(UUID id) { return employees.findById(id).orElseThrow(() -> new NotFoundException("Employee not found.")); }
    private EmployeeContact findContact(UUID id) { return contacts.findById(id).orElseThrow(() -> new NotFoundException("Employee contact not found.")); }
    private AttendanceRecord findAttendance(UUID id) { return attendanceRecords.findById(id).orElseThrow(() -> new NotFoundException("Attendance record not found.")); }
    private LeaveRequest findLeave(UUID id) { return leaveRequests.findById(id).orElseThrow(() -> new NotFoundException("Leave request not found.")); }
    private HolidayRecord findHoliday(UUID id) { return holidays.findById(id).orElseThrow(() -> new NotFoundException("Holiday not found.")); }
    private PayrollSummary findPayroll(UUID id) { return payrollSummaries.findById(id).orElseThrow(() -> new NotFoundException("Payroll summary not found.")); }
    private PerformanceReview findPerformance(UUID id) { return performanceReviews.findById(id).orElseThrow(() -> new NotFoundException("Performance review not found.")); }
    private TrainingRecord findTraining(UUID id) { return trainings.findById(id).orElseThrow(() -> new NotFoundException("Training record not found.")); }
    private EmployeeCertification findCertification(UUID id) { return certifications.findById(id).orElseThrow(() -> new NotFoundException("Certification not found.")); }
    private ExitRecord findExit(UUID id) { return exitRecords.findById(id).orElseThrow(() -> new NotFoundException("Exit record not found.")); }
    private DocumentRecord findDocument(UUID id) { return id == null ? null : documents.findById(id).orElseThrow(() -> new NotFoundException("Document not found.")); }

    private UUID id(Object entity) { if (entity instanceof Department item) return item.getId(); if (entity instanceof Designation item) return item.getId(); if (entity instanceof Employee item) return item.getId(); if (entity instanceof DocumentRecord item) return item.getId(); if (entity instanceof TrainingRecord item) return item.getId(); return null; }
    private String deptName(Department item) { return item == null ? null : item.getDepartmentName(); }
    private String title(Designation item) { return item == null ? null : item.getTitle(); }
    private String empName(Employee item) { return item == null ? null : item.getFullName(); }
    private String docTitle(DocumentRecord item) { return item == null ? null : item.getTitle(); }
    private boolean isExited(Employee item) { return item.getEmploymentStatus() == EmploymentStatus.RESIGNED || item.getEmploymentStatus() == EmploymentStatus.TERMINATED || item.getEmploymentStatus() == EmploymentStatus.RETIRED; }
    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private void requireFounder(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER); }
    private void audit(AppUser actor, String action, String description, String severity) { auditService.record(actor, MODULE, action, description, severity); }
    private BigDecimal money(BigDecimal value) { return value == null ? ZERO : value.setScale(2, RoundingMode.HALF_UP); }
    private String required(String value, String label) { if (value == null || value.isBlank()) throw new IllegalArgumentException(label + " is required."); return value.trim(); }
    private <T> T required(T value, String label) { if (value == null) throw new IllegalArgumentException(label + " is required."); return value; }
    private String requiredEmail(String value) { String email = required(value, "Email"); if (!email.contains("@")) throw new IllegalArgumentException("Email must be valid."); return email; }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private boolean matches(String query, String... values) { if (query == null || query.isBlank()) return true; String needle = query.toLowerCase(Locale.ROOT).trim(); for (String value : values) if (value != null && value.toLowerCase(Locale.ROOT).contains(needle)) return true; return false; }
}
