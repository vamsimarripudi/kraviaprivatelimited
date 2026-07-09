package com.kravia.companyos.hr;

import com.kravia.companyos.hr.HrEnums.AttendanceStatus;
import com.kravia.companyos.hr.HrEnums.EmploymentStatus;
import com.kravia.companyos.hr.HrEnums.EmploymentType;
import com.kravia.companyos.hr.HrEnums.ExitStatus;
import com.kravia.companyos.hr.HrEnums.HrReportType;
import com.kravia.companyos.hr.HrEnums.LeaveStatus;
import com.kravia.companyos.hr.HrEnums.LeaveType;
import com.kravia.companyos.hr.HrEnums.OrganizationLevel;
import com.kravia.companyos.hr.HrEnums.PayrollStatus;
import com.kravia.companyos.hr.HrEnums.PerformanceRating;
import com.kravia.companyos.hr.HrEnums.ProbationStatus;
import com.kravia.companyos.hr.HrEnums.TrainingStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class HrDto {
    private HrDto() {}

    public record HrMetric(String label, long value, String tone) {}

    public record HrSummaryResponse(long activeEmployees, long departments, long pendingLeaveRequests, long todayAttendanceRecords, long payrollRecords, long openExitRecords, List<HrMetric> metrics) {}

    public record DepartmentRequest(String departmentName, String description, UUID parentDepartmentId, OrganizationLevel organizationLevel, UUID headEmployeeId, EmploymentStatus status) {}
    public record DepartmentResponse(UUID id, String departmentName, String description, UUID parentDepartmentId, String parentDepartmentName, OrganizationLevel organizationLevel, UUID headEmployeeId, EmploymentStatus status, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record DesignationRequest(String title, UUID departmentId, OrganizationLevel organizationLevel, String description, EmploymentStatus status) {}
    public record DesignationResponse(UUID id, String title, UUID departmentId, String departmentName, OrganizationLevel organizationLevel, String description, EmploymentStatus status, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record EmployeeRequest(String employeeId, String fullName, String preferredName, UUID profilePhotoDocumentId, String email, String phone, String emergencyContact, UUID departmentId, UUID designationId, UUID reportingManagerId, EmploymentType employmentType, LocalDate dateOfJoining, ProbationStatus probationStatus, String workLocation, EmploymentStatus employmentStatus, String skills, String certifications, UUID relatedDocumentId, String notes) {}
    public record EmployeeResponse(UUID id, String employeeId, String fullName, String preferredName, UUID profilePhotoDocumentId, String profilePhotoTitle, String email, String phone, String emergencyContact, UUID departmentId, String departmentName, UUID designationId, String designationTitle, UUID reportingManagerId, String reportingManagerName, EmploymentType employmentType, LocalDate dateOfJoining, ProbationStatus probationStatus, String workLocation, EmploymentStatus employmentStatus, String skills, String certifications, UUID relatedDocumentId, String relatedDocumentTitle, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record EmployeeContactRequest(UUID employeeId, String contactType, String contactName, String relationship, String phone, String email, String notes) {}
    public record EmployeeContactResponse(UUID id, UUID employeeId, String employeeName, String contactType, String contactName, String relationship, String phone, String email, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record AttendanceRequest(UUID employeeId, LocalDate attendanceDate, AttendanceStatus status, String workLocation, String notes) {}
    public record AttendanceResponse(UUID id, UUID employeeId, String employeeName, LocalDate attendanceDate, AttendanceStatus status, String workLocation, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record LeaveRequestPayload(UUID employeeId, LeaveType leaveType, LocalDate startDate, LocalDate endDate, BigDecimal totalDays, LeaveStatus status, UUID managerId, String approvalNotes, UUID relatedTaskId) {}
    public record LeaveResponse(UUID id, UUID employeeId, String employeeName, LeaveType leaveType, LocalDate startDate, LocalDate endDate, BigDecimal totalDays, LeaveStatus status, UUID managerId, String managerName, String approvalNotes, UUID relatedTaskId, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record HolidayRequest(String holidayName, LocalDate holidayDate, String description, EmploymentStatus status) {}
    public record HolidayResponse(UUID id, String holidayName, LocalDate holidayDate, String description, EmploymentStatus status, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record PayrollRequest(UUID employeeId, String payrollMonth, String salaryStructure, BigDecimal basicSalary, BigDecimal allowances, BigDecimal deductions, BigDecimal pf, BigDecimal esi, BigDecimal professionalTax, BigDecimal tds, PayrollStatus status, UUID linkedFinancialRecordId, String notes) {}
    public record PayrollResponse(UUID id, UUID employeeId, String employeeName, String payrollMonth, String salaryStructure, BigDecimal basicSalary, BigDecimal allowances, BigDecimal deductions, BigDecimal pf, BigDecimal esi, BigDecimal professionalTax, BigDecimal tds, BigDecimal netSalary, PayrollStatus status, UUID linkedFinancialRecordId, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record PerformanceReviewRequest(UUID employeeId, String reviewCycle, String goals, String achievements, String managerFeedback, String employeeFeedback, PerformanceRating rating, String improvementPlan, LocalDate reviewDate, UUID reviewerId, UUID relatedTaskId, EmploymentStatus status) {}
    public record PerformanceReviewResponse(UUID id, UUID employeeId, String employeeName, String reviewCycle, String goals, String achievements, String managerFeedback, String employeeFeedback, PerformanceRating rating, String improvementPlan, LocalDate reviewDate, UUID reviewerId, String reviewerName, UUID relatedTaskId, EmploymentStatus status, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record TrainingRequest(String trainingName, String provider, LocalDate completionDate, LocalDate expiryDate, UUID certificateDocumentId, String skillsCovered, TrainingStatus status, String notes) {}
    public record TrainingResponse(UUID id, String trainingName, String provider, LocalDate completionDate, LocalDate expiryDate, UUID certificateDocumentId, String certificateDocumentTitle, String skillsCovered, TrainingStatus status, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record CertificationRequest(UUID employeeId, UUID trainingId, String certificationName, String provider, LocalDate issueDate, LocalDate expiryDate, UUID certificateDocumentId, String skillsCovered, TrainingStatus status) {}
    public record CertificationResponse(UUID id, UUID employeeId, String employeeName, UUID trainingId, String trainingName, String certificationName, String provider, LocalDate issueDate, LocalDate expiryDate, UUID certificateDocumentId, String certificateDocumentTitle, String skillsCovered, TrainingStatus status, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record ExitRequestPayload(UUID employeeId, LocalDate resignationDate, LocalDate lastWorkingDay, String reason, String exitChecklist, String assetReturnStatus, String finalSettlementStatus, String knowledgeTransferStatus, String exitInterviewNotes, UUID relatedDocumentId, ExitStatus status) {}
    public record ExitResponse(UUID id, UUID employeeId, String employeeName, LocalDate resignationDate, LocalDate lastWorkingDay, String reason, String exitChecklist, String assetReturnStatus, String finalSettlementStatus, String knowledgeTransferStatus, String exitInterviewNotes, UUID relatedDocumentId, String relatedDocumentTitle, ExitStatus status, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record HrReportResponse(HrReportType reportType, Instant generatedAt, List<HrMetric> metrics, List<String> notes) {}
}
