package com.kravia.companyos.hr;

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
import com.kravia.companyos.user.AppUser;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/hr")
public class HrController {
    private final HrService service;

    public HrController(HrService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public HrSummaryResponse summary(@AuthenticationPrincipal AppUser actor) {
        return service.summary(actor);
    }

    @GetMapping("/departments")
    public List<DepartmentResponse> departments(@RequestParam(required = false) String query, @AuthenticationPrincipal AppUser actor) {
        return service.departments(query, actor);
    }

    @PostMapping("/departments")
    public DepartmentResponse createDepartment(@RequestBody DepartmentRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveDepartment(null, request, actor);
    }

    @PutMapping("/departments/{id}")
    public DepartmentResponse updateDepartment(@PathVariable UUID id, @RequestBody DepartmentRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveDepartment(id, request, actor);
    }

    @DeleteMapping("/departments/{id}")
    public void archiveDepartment(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveDepartment(id, actor);
    }

    @GetMapping("/designations")
    public List<DesignationResponse> designations(@RequestParam(required = false) String query, @AuthenticationPrincipal AppUser actor) {
        return service.designations(query, actor);
    }

    @PostMapping("/designations")
    public DesignationResponse createDesignation(@RequestBody DesignationRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveDesignation(null, request, actor);
    }

    @PutMapping("/designations/{id}")
    public DesignationResponse updateDesignation(@PathVariable UUID id, @RequestBody DesignationRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveDesignation(id, request, actor);
    }

    @DeleteMapping("/designations/{id}")
    public void archiveDesignation(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveDesignation(id, actor);
    }

    @GetMapping("/employees")
    public List<EmployeeResponse> employees(@RequestParam(required = false) String query, @RequestParam(required = false) EmploymentStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.employees(query, status, actor);
    }

    @PostMapping("/employees")
    public EmployeeResponse createEmployee(@RequestBody EmployeeRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveEmployee(null, request, actor);
    }

    @PutMapping("/employees/{id}")
    public EmployeeResponse updateEmployee(@PathVariable UUID id, @RequestBody EmployeeRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveEmployee(id, request, actor);
    }

    @DeleteMapping("/employees/{id}")
    public void archiveEmployee(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveEmployee(id, actor);
    }

    @GetMapping("/contacts")
    public List<EmployeeContactResponse> contacts(@RequestParam(required = false) String query, @AuthenticationPrincipal AppUser actor) {
        return service.contacts(query, actor);
    }

    @PostMapping("/contacts")
    public EmployeeContactResponse createContact(@RequestBody EmployeeContactRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveContact(null, request, actor);
    }

    @PutMapping("/contacts/{id}")
    public EmployeeContactResponse updateContact(@PathVariable UUID id, @RequestBody EmployeeContactRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveContact(id, request, actor);
    }

    @DeleteMapping("/contacts/{id}")
    public void archiveContact(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "contact", actor);
    }

    @GetMapping("/attendance")
    public List<AttendanceResponse> attendance(@RequestParam(required = false) String query, @RequestParam(required = false) AttendanceStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.attendance(query, status, actor);
    }

    @PostMapping("/attendance")
    public AttendanceResponse createAttendance(@RequestBody AttendanceRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveAttendance(null, request, actor);
    }

    @PutMapping("/attendance/{id}")
    public AttendanceResponse updateAttendance(@PathVariable UUID id, @RequestBody AttendanceRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveAttendance(id, request, actor);
    }

    @DeleteMapping("/attendance/{id}")
    public void archiveAttendance(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "attendance", actor);
    }

    @GetMapping("/leave-requests")
    public List<LeaveResponse> leaveRequests(@RequestParam(required = false) String query, @RequestParam(required = false) LeaveStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.leaves(query, status, actor);
    }

    @PostMapping("/leave-requests")
    public LeaveResponse createLeaveRequest(@RequestBody LeaveRequestPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.saveLeave(null, request, actor);
    }

    @PutMapping("/leave-requests/{id}")
    public LeaveResponse updateLeaveRequest(@PathVariable UUID id, @RequestBody LeaveRequestPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.saveLeave(id, request, actor);
    }

    @DeleteMapping("/leave-requests/{id}")
    public void archiveLeaveRequest(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "leave", actor);
    }

    @GetMapping("/holidays")
    public List<HolidayResponse> holidays(@RequestParam(required = false) String query, @AuthenticationPrincipal AppUser actor) {
        return service.holidays(query, actor);
    }

    @PostMapping("/holidays")
    public HolidayResponse createHoliday(@RequestBody HolidayRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveHoliday(null, request, actor);
    }

    @PutMapping("/holidays/{id}")
    public HolidayResponse updateHoliday(@PathVariable UUID id, @RequestBody HolidayRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveHoliday(id, request, actor);
    }

    @DeleteMapping("/holidays/{id}")
    public void archiveHoliday(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "holiday", actor);
    }

    @GetMapping("/payroll-summaries")
    public List<PayrollResponse> payrollSummaries(@RequestParam(required = false) String query, @RequestParam(required = false) PayrollStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.payroll(query, status, actor);
    }

    @PostMapping("/payroll-summaries")
    public PayrollResponse createPayrollSummary(@RequestBody PayrollRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.savePayroll(null, request, actor);
    }

    @PutMapping("/payroll-summaries/{id}")
    public PayrollResponse updatePayrollSummary(@PathVariable UUID id, @RequestBody PayrollRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.savePayroll(id, request, actor);
    }

    @DeleteMapping("/payroll-summaries/{id}")
    public void archivePayrollSummary(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "payroll", actor);
    }

    @GetMapping("/performance-reviews")
    public List<PerformanceReviewResponse> performanceReviews(@RequestParam(required = false) String query, @AuthenticationPrincipal AppUser actor) {
        return service.performance(query, actor);
    }

    @PostMapping("/performance-reviews")
    public PerformanceReviewResponse createPerformanceReview(@RequestBody PerformanceReviewRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.savePerformance(null, request, actor);
    }

    @PutMapping("/performance-reviews/{id}")
    public PerformanceReviewResponse updatePerformanceReview(@PathVariable UUID id, @RequestBody PerformanceReviewRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.savePerformance(id, request, actor);
    }

    @DeleteMapping("/performance-reviews/{id}")
    public void archivePerformanceReview(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "performance", actor);
    }

    @GetMapping("/trainings")
    public List<TrainingResponse> trainings(@RequestParam(required = false) String query, @RequestParam(required = false) TrainingStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.trainings(query, status, actor);
    }

    @PostMapping("/trainings")
    public TrainingResponse createTraining(@RequestBody TrainingRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveTraining(null, request, actor);
    }

    @PutMapping("/trainings/{id}")
    public TrainingResponse updateTraining(@PathVariable UUID id, @RequestBody TrainingRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveTraining(id, request, actor);
    }

    @DeleteMapping("/trainings/{id}")
    public void archiveTraining(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "training", actor);
    }

    @GetMapping("/certifications")
    public List<CertificationResponse> certifications(@RequestParam(required = false) String query, @RequestParam(required = false) TrainingStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.certifications(query, status, actor);
    }

    @PostMapping("/certifications")
    public CertificationResponse createCertification(@RequestBody CertificationRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveCertification(null, request, actor);
    }

    @PutMapping("/certifications/{id}")
    public CertificationResponse updateCertification(@PathVariable UUID id, @RequestBody CertificationRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveCertification(id, request, actor);
    }

    @DeleteMapping("/certifications/{id}")
    public void archiveCertification(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "certification", actor);
    }

    @GetMapping("/exit-records")
    public List<ExitResponse> exitRecords(@RequestParam(required = false) String query, @RequestParam(required = false) ExitStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.exits(query, status, actor);
    }

    @PostMapping("/exit-records")
    public ExitResponse createExitRecord(@RequestBody ExitRequestPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.saveExit(null, request, actor);
    }

    @PutMapping("/exit-records/{id}")
    public ExitResponse updateExitRecord(@PathVariable UUID id, @RequestBody ExitRequestPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.saveExit(id, request, actor);
    }

    @DeleteMapping("/exit-records/{id}")
    public void archiveExitRecord(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, "exit", actor);
    }

    @GetMapping("/reports")
    public HrReportResponse report(@RequestParam(defaultValue = "EMPLOYEE_DIRECTORY") HrReportType type, @AuthenticationPrincipal AppUser actor) {
        return service.report(type, actor);
    }
}
