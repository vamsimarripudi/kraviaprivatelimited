import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ApiService } from '../core/http/api.service';
import {
  AttendanceRecord,
  AttendanceStatus,
  CertificationRecord,
  DepartmentRecord,
  DesignationRecord,
  EmployeeContactRecord,
  EmployeeRecord,
  EmploymentStatus,
  EmploymentType,
  ExitRecord,
  ExitStatus,
  HolidayRecord,
  HrReport,
  HrReportType,
  HrSummary,
  LeaveRecord,
  LeaveStatus,
  LeaveType,
  OrganizationLevel,
  PayrollRecord,
  PayrollStatus,
  PerformanceRating,
  PerformanceReviewRecord,
  ProbationStatus,
  TrainingRecord,
  TrainingStatus
} from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

type HrTab = 'dashboard' | 'organization' | 'employees' | 'contacts' | 'attendance' | 'leave' | 'holidays' | 'payroll' | 'performance' | 'training' | 'exit' | 'reports';

@Component({
  selector: 'kravia-hr',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './hr.component.html'
})
export class HrComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly tabs: Array<{ value: HrTab; label: string }> = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'organization', label: 'Organization' },
    { value: 'employees', label: 'Employees' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'leave', label: 'Leave' },
    { value: 'holidays', label: 'Holidays' },
    { value: 'payroll', label: 'Payroll' },
    { value: 'performance', label: 'Performance' },
    { value: 'training', label: 'Training' },
    { value: 'exit', label: 'Exit' },
    { value: 'reports', label: 'Reports' }
  ];

  readonly organizationLevels: OrganizationLevel[] = ['FOUNDER', 'BOARD_OF_DIRECTORS', 'EXECUTIVE_LEADERSHIP', 'DEPARTMENT_HEADS', 'TEAM_LEADS', 'EMPLOYEES', 'INTERNS', 'CONTRACTORS', 'ADVISORS'];
  readonly employmentTypes: EmploymentType[] = ['FOUNDER', 'DIRECTOR', 'FULL_TIME', 'PART_TIME', 'CONTRACT', 'CONSULTANT', 'ADVISOR', 'INTERN'];
  readonly employmentStatuses: EmploymentStatus[] = ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED', 'RETIRED', 'ARCHIVED'];
  readonly probationStatuses: ProbationStatus[] = ['NOT_APPLICABLE', 'IN_PROGRESS', 'CONFIRMED', 'EXTENDED'];
  readonly attendanceStatuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LEAVE', 'WFH', 'HOLIDAY', 'HALF_DAY'];
  readonly leaveTypes: LeaveType[] = ['CASUAL_LEAVE', 'SICK_LEAVE', 'EARNED_LEAVE', 'WORK_FROM_HOME', 'COMPENSATORY_OFF', 'MATERNITY_LEAVE', 'PATERNITY_LEAVE', 'UNPAID_LEAVE'];
  readonly leaveStatuses: LeaveStatus[] = ['REQUESTED', 'MANAGER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'ARCHIVED'];
  readonly payrollStatuses: PayrollStatus[] = ['DRAFT', 'FINAL', 'PAID', 'ARCHIVED'];
  readonly performanceRatings: PerformanceRating[] = ['NOT_RATED', 'EXCEEDS_EXPECTATIONS', 'MEETS_EXPECTATIONS', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY'];
  readonly trainingStatuses: TrainingStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ARCHIVED'];
  readonly exitStatuses: ExitStatus[] = ['INITIATED', 'IN_PROGRESS', 'CLEARED', 'FINAL_SETTLEMENT_PENDING', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];
  readonly reportTypes: HrReportType[] = ['EMPLOYEE_DIRECTORY', 'DEPARTMENT_SUMMARY', 'LEAVE_REPORT', 'ATTENDANCE_REPORT', 'PAYROLL_SUMMARY', 'PERFORMANCE_REPORT', 'TRAINING_REPORT', 'EXIT_REPORT'];

  readonly activeTab = signal<HrTab>('dashboard');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly summary = signal<HrSummary | null>(null);
  readonly departments = signal<DepartmentRecord[]>([]);
  readonly designations = signal<DesignationRecord[]>([]);
  readonly employees = signal<EmployeeRecord[]>([]);
  readonly contacts = signal<EmployeeContactRecord[]>([]);
  readonly attendanceRecords = signal<AttendanceRecord[]>([]);
  readonly leaveRequests = signal<LeaveRecord[]>([]);
  readonly holidays = signal<HolidayRecord[]>([]);
  readonly payrollSummaries = signal<PayrollRecord[]>([]);
  readonly performanceReviews = signal<PerformanceReviewRecord[]>([]);
  readonly trainings = signal<TrainingRecord[]>([]);
  readonly certifications = signal<CertificationRecord[]>([]);
  readonly exitRecords = signal<ExitRecord[]>([]);
  readonly report = signal<HrReport | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));

  readonly editingDepartmentId = signal<string | null>(null);
  readonly editingDesignationId = signal<string | null>(null);
  readonly editingEmployeeId = signal<string | null>(null);
  readonly editingContactId = signal<string | null>(null);
  readonly editingAttendanceId = signal<string | null>(null);
  readonly editingLeaveId = signal<string | null>(null);
  readonly editingHolidayId = signal<string | null>(null);
  readonly editingPayrollId = signal<string | null>(null);
  readonly editingPerformanceId = signal<string | null>(null);
  readonly editingTrainingId = signal<string | null>(null);
  readonly editingCertificationId = signal<string | null>(null);
  readonly editingExitId = signal<string | null>(null);

  readonly queryForm = this.fb.nonNullable.group({ query: [''] });
  readonly employeeFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as EmploymentStatus | ''] });
  readonly attendanceFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as AttendanceStatus | ''] });
  readonly leaveFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as LeaveStatus | ''] });
  readonly payrollFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as PayrollStatus | ''] });
  readonly trainingFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as TrainingStatus | ''] });
  readonly certificationFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as TrainingStatus | ''] });
  readonly exitFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as ExitStatus | ''] });

  readonly departmentForm = this.fb.nonNullable.group({
    departmentName: ['', Validators.required],
    description: [''],
    parentDepartmentId: [''],
    organizationLevel: ['EMPLOYEES' as OrganizationLevel],
    headEmployeeId: [''],
    status: ['ACTIVE' as EmploymentStatus, Validators.required]
  });
  readonly designationForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    departmentId: [''],
    organizationLevel: ['EMPLOYEES' as OrganizationLevel],
    description: [''],
    status: ['ACTIVE' as EmploymentStatus, Validators.required]
  });
  readonly employeeForm = this.fb.nonNullable.group({
    employeeId: ['', Validators.required],
    fullName: ['', Validators.required],
    preferredName: [''],
    profilePhotoDocumentId: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    emergencyContact: [''],
    departmentId: [''],
    designationId: [''],
    reportingManagerId: [''],
    employmentType: ['FULL_TIME' as EmploymentType, Validators.required],
    dateOfJoining: ['', Validators.required],
    probationStatus: ['NOT_APPLICABLE' as ProbationStatus, Validators.required],
    workLocation: [''],
    employmentStatus: ['ACTIVE' as EmploymentStatus, Validators.required],
    skills: [''],
    certifications: [''],
    relatedDocumentId: [''],
    notes: ['']
  });
  readonly contactForm = this.fb.nonNullable.group({ employeeId: ['', Validators.required], contactType: ['Emergency', Validators.required], contactName: ['', Validators.required], relationship: [''], phone: [''], email: ['', Validators.email], notes: [''] });
  readonly attendanceForm = this.fb.nonNullable.group({ employeeId: ['', Validators.required], attendanceDate: ['', Validators.required], status: ['PRESENT' as AttendanceStatus, Validators.required], workLocation: [''], notes: [''] });
  readonly leaveForm = this.fb.nonNullable.group({ employeeId: ['', Validators.required], leaveType: ['CASUAL_LEAVE' as LeaveType, Validators.required], startDate: ['', Validators.required], endDate: ['', Validators.required], totalDays: [1, [Validators.required, Validators.min(0.5)]], status: ['REQUESTED' as LeaveStatus, Validators.required], managerId: [''], approvalNotes: [''], relatedTaskId: [''] });
  readonly holidayForm = this.fb.nonNullable.group({ holidayName: ['', Validators.required], holidayDate: ['', Validators.required], description: [''], status: ['ACTIVE' as EmploymentStatus, Validators.required] });
  readonly payrollForm = this.fb.nonNullable.group({ employeeId: ['', Validators.required], payrollMonth: ['', Validators.required], salaryStructure: [''], basicSalary: [0, [Validators.required, Validators.min(0)]], allowances: [0, Validators.min(0)], deductions: [0, Validators.min(0)], pf: [0, Validators.min(0)], esi: [0, Validators.min(0)], professionalTax: [0, Validators.min(0)], tds: [0, Validators.min(0)], status: ['DRAFT' as PayrollStatus, Validators.required], linkedFinancialRecordId: [''], notes: [''] });
  readonly performanceForm = this.fb.nonNullable.group({ employeeId: ['', Validators.required], reviewCycle: ['', Validators.required], goals: [''], achievements: [''], managerFeedback: [''], employeeFeedback: [''], rating: ['NOT_RATED' as PerformanceRating, Validators.required], improvementPlan: [''], reviewDate: ['', Validators.required], reviewerId: [''], relatedTaskId: [''], status: ['ACTIVE' as EmploymentStatus, Validators.required] });
  readonly trainingForm = this.fb.nonNullable.group({ trainingName: ['', Validators.required], provider: [''], completionDate: [''], expiryDate: [''], certificateDocumentId: [''], skillsCovered: [''], status: ['PLANNED' as TrainingStatus, Validators.required], notes: [''] });
  readonly certificationForm = this.fb.nonNullable.group({ employeeId: ['', Validators.required], trainingId: [''], certificationName: ['', Validators.required], provider: [''], issueDate: [''], expiryDate: [''], certificateDocumentId: [''], skillsCovered: [''], status: ['PLANNED' as TrainingStatus, Validators.required] });
  readonly exitForm = this.fb.nonNullable.group({ employeeId: ['', Validators.required], resignationDate: [''], lastWorkingDay: [''], reason: [''], exitChecklist: [''], assetReturnStatus: [''], finalSettlementStatus: [''], knowledgeTransferStatus: [''], exitInterviewNotes: [''], relatedDocumentId: [''], status: ['INITIATED' as ExitStatus, Validators.required] });
  readonly reportForm = this.fb.nonNullable.group({ reportType: ['EMPLOYEE_DIRECTORY' as HrReportType, Validators.required] });

  constructor() { this.load(); }

  setTab(tab: HrTab): void { this.activeTab.set(tab); this.error.set(''); this.success.set(''); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const query = this.queryForm.getRawValue().query;
    forkJoin({
      summary: this.api.hrSummary(),
      departments: this.api.hrDepartments({ query }),
      designations: this.api.hrDesignations({ query }),
      employees: this.api.hrEmployees(this.employeeFilterForm.getRawValue()),
      contacts: this.api.hrContacts({ query }),
      attendance: this.api.hrAttendance(this.attendanceFilterForm.getRawValue()),
      leave: this.api.hrLeaveRequests(this.leaveFilterForm.getRawValue()),
      holidays: this.api.hrHolidays({ query }),
      payroll: this.api.hrPayrollSummaries(this.payrollFilterForm.getRawValue()),
      performance: this.api.hrPerformanceReviews({ query }),
      trainings: this.api.hrTrainings(this.trainingFilterForm.getRawValue()),
      certifications: this.api.hrCertifications(this.certificationFilterForm.getRawValue()),
      exits: this.api.hrExitRecords(this.exitFilterForm.getRawValue())
    }).subscribe({
      next: (result) => {
        this.summary.set(result.summary);
        this.departments.set(result.departments);
        this.designations.set(result.designations);
        this.employees.set(result.employees);
        this.contacts.set(result.contacts);
        this.attendanceRecords.set(result.attendance);
        this.leaveRequests.set(result.leave);
        this.holidays.set(result.holidays);
        this.payrollSummaries.set(result.payroll);
        this.performanceReviews.set(result.performance);
        this.trainings.set(result.trainings);
        this.certifications.set(result.certifications);
        this.exitRecords.set(result.exits);
        this.loading.set(false);
      },
      error: () => { this.error.set('HR records could not be loaded.'); this.loading.set(false); }
    });
  }

  saveDepartment(): void { if (this.departmentForm.invalid) return; const id = this.editingDepartmentId(); this.run(id ? this.api.updateHrDepartment(id, this.clean(this.departmentForm.getRawValue())) : this.api.createHrDepartment(this.clean(this.departmentForm.getRawValue())), id ? 'Department updated.' : 'Department created.', () => this.resetDepartmentForm()); }
  saveDesignation(): void { if (this.designationForm.invalid) return; const id = this.editingDesignationId(); this.run(id ? this.api.updateHrDesignation(id, this.clean(this.designationForm.getRawValue())) : this.api.createHrDesignation(this.clean(this.designationForm.getRawValue())), id ? 'Designation updated.' : 'Designation created.', () => this.resetDesignationForm()); }
  saveEmployee(): void { if (this.employeeForm.invalid) return; const id = this.editingEmployeeId(); this.run(id ? this.api.updateHrEmployee(id, this.clean(this.employeeForm.getRawValue())) : this.api.createHrEmployee(this.clean(this.employeeForm.getRawValue())), id ? 'Employee updated.' : 'Employee created.', () => this.resetEmployeeForm()); }
  saveContact(): void { if (this.contactForm.invalid) return; const id = this.editingContactId(); this.run(id ? this.api.updateHrContact(id, this.clean(this.contactForm.getRawValue())) : this.api.createHrContact(this.clean(this.contactForm.getRawValue())), id ? 'Contact updated.' : 'Contact created.', () => this.resetContactForm()); }
  saveAttendance(): void { if (this.attendanceForm.invalid) return; const id = this.editingAttendanceId(); this.run(id ? this.api.updateHrAttendance(id, this.clean(this.attendanceForm.getRawValue())) : this.api.createHrAttendance(this.clean(this.attendanceForm.getRawValue())), id ? 'Attendance updated.' : 'Attendance recorded.', () => this.resetAttendanceForm()); }
  saveLeave(): void { if (this.leaveForm.invalid) return; const value = this.leaveForm.getRawValue(); const payload = { ...this.clean(value), totalDays: Number(value.totalDays || 0) }; const id = this.editingLeaveId(); this.run(id ? this.api.updateHrLeaveRequest(id, payload) : this.api.createHrLeaveRequest(payload), id ? 'Leave request updated.' : 'Leave request created.', () => this.resetLeaveForm()); }
  saveHoliday(): void { if (this.holidayForm.invalid) return; const id = this.editingHolidayId(); this.run(id ? this.api.updateHrHoliday(id, this.clean(this.holidayForm.getRawValue())) : this.api.createHrHoliday(this.clean(this.holidayForm.getRawValue())), id ? 'Holiday updated.' : 'Holiday created.', () => this.resetHolidayForm()); }
  savePayroll(): void { if (this.payrollForm.invalid) return; const value = this.payrollForm.getRawValue(); const payload = { ...this.clean(value), basicSalary: Number(value.basicSalary || 0), allowances: Number(value.allowances || 0), deductions: Number(value.deductions || 0), pf: Number(value.pf || 0), esi: Number(value.esi || 0), professionalTax: Number(value.professionalTax || 0), tds: Number(value.tds || 0) }; const id = this.editingPayrollId(); this.run(id ? this.api.updateHrPayrollSummary(id, payload) : this.api.createHrPayrollSummary(payload), id ? 'Payroll summary updated.' : 'Payroll summary created.', () => this.resetPayrollForm()); }
  savePerformance(): void { if (this.performanceForm.invalid) return; const id = this.editingPerformanceId(); this.run(id ? this.api.updateHrPerformanceReview(id, this.clean(this.performanceForm.getRawValue())) : this.api.createHrPerformanceReview(this.clean(this.performanceForm.getRawValue())), id ? 'Performance review updated.' : 'Performance review created.', () => this.resetPerformanceForm()); }
  saveTraining(): void { if (this.trainingForm.invalid) return; const id = this.editingTrainingId(); this.run(id ? this.api.updateHrTraining(id, this.clean(this.trainingForm.getRawValue())) : this.api.createHrTraining(this.clean(this.trainingForm.getRawValue())), id ? 'Training updated.' : 'Training created.', () => this.resetTrainingForm()); }
  saveCertification(): void { if (this.certificationForm.invalid) return; const id = this.editingCertificationId(); this.run(id ? this.api.updateHrCertification(id, this.clean(this.certificationForm.getRawValue())) : this.api.createHrCertification(this.clean(this.certificationForm.getRawValue())), id ? 'Certification updated.' : 'Certification created.', () => this.resetCertificationForm()); }
  saveExit(): void { if (this.exitForm.invalid) return; const id = this.editingExitId(); this.run(id ? this.api.updateHrExitRecord(id, this.clean(this.exitForm.getRawValue())) : this.api.createHrExitRecord(this.clean(this.exitForm.getRawValue())), id ? 'Exit record updated.' : 'Exit record created.', () => this.resetExitForm()); }

  editDepartment(item: DepartmentRecord): void { if (!this.canEdit()) return; this.editingDepartmentId.set(item.id); this.departmentForm.reset({ departmentName: item.departmentName, description: item.description || '', parentDepartmentId: item.parentDepartmentId || '', organizationLevel: item.organizationLevel || 'EMPLOYEES', headEmployeeId: item.headEmployeeId || '', status: item.status }); }
  editDesignation(item: DesignationRecord): void { if (!this.canEdit()) return; this.editingDesignationId.set(item.id); this.designationForm.reset({ title: item.title, departmentId: item.departmentId || '', organizationLevel: item.organizationLevel || 'EMPLOYEES', description: item.description || '', status: item.status }); }
  editEmployee(item: EmployeeRecord): void { if (!this.canEdit()) return; this.editingEmployeeId.set(item.id); this.employeeForm.reset({ employeeId: item.employeeId, fullName: item.fullName, preferredName: item.preferredName || '', profilePhotoDocumentId: item.profilePhotoDocumentId || '', email: item.email, phone: item.phone || '', emergencyContact: item.emergencyContact || '', departmentId: item.departmentId || '', designationId: item.designationId || '', reportingManagerId: item.reportingManagerId || '', employmentType: item.employmentType, dateOfJoining: item.dateOfJoining, probationStatus: item.probationStatus, workLocation: item.workLocation || '', employmentStatus: item.employmentStatus, skills: item.skills || '', certifications: item.certifications || '', relatedDocumentId: item.relatedDocumentId || '', notes: item.notes || '' }); }
  editContact(item: EmployeeContactRecord): void { if (!this.canEdit()) return; this.editingContactId.set(item.id); this.contactForm.reset({ employeeId: item.employeeId, contactType: item.contactType, contactName: item.contactName, relationship: item.relationship || '', phone: item.phone || '', email: item.email || '', notes: item.notes || '' }); }
  editAttendance(item: AttendanceRecord): void { if (!this.canEdit()) return; this.editingAttendanceId.set(item.id); this.attendanceForm.reset({ employeeId: item.employeeId, attendanceDate: item.attendanceDate, status: item.status, workLocation: item.workLocation || '', notes: item.notes || '' }); }
  editLeave(item: LeaveRecord): void { if (!this.canEdit()) return; this.editingLeaveId.set(item.id); this.leaveForm.reset({ employeeId: item.employeeId, leaveType: item.leaveType, startDate: item.startDate, endDate: item.endDate, totalDays: item.totalDays, status: item.status, managerId: item.managerId || '', approvalNotes: item.approvalNotes || '', relatedTaskId: item.relatedTaskId || '' }); }
  editHoliday(item: HolidayRecord): void { if (!this.canEdit()) return; this.editingHolidayId.set(item.id); this.holidayForm.reset({ holidayName: item.holidayName, holidayDate: item.holidayDate, description: item.description || '', status: item.status }); }
  editPayroll(item: PayrollRecord): void { if (!this.canEdit()) return; this.editingPayrollId.set(item.id); this.payrollForm.reset({ employeeId: item.employeeId, payrollMonth: item.payrollMonth, salaryStructure: item.salaryStructure || '', basicSalary: item.basicSalary || 0, allowances: item.allowances || 0, deductions: item.deductions || 0, pf: item.pf || 0, esi: item.esi || 0, professionalTax: item.professionalTax || 0, tds: item.tds || 0, status: item.status, linkedFinancialRecordId: item.linkedFinancialRecordId || '', notes: item.notes || '' }); }
  editPerformance(item: PerformanceReviewRecord): void { if (!this.canEdit()) return; this.editingPerformanceId.set(item.id); this.performanceForm.reset({ employeeId: item.employeeId, reviewCycle: item.reviewCycle, goals: item.goals || '', achievements: item.achievements || '', managerFeedback: item.managerFeedback || '', employeeFeedback: item.employeeFeedback || '', rating: item.rating, improvementPlan: item.improvementPlan || '', reviewDate: item.reviewDate, reviewerId: item.reviewerId || '', relatedTaskId: item.relatedTaskId || '', status: item.status }); }
  editTraining(item: TrainingRecord): void { if (!this.canEdit()) return; this.editingTrainingId.set(item.id); this.trainingForm.reset({ trainingName: item.trainingName, provider: item.provider || '', completionDate: item.completionDate || '', expiryDate: item.expiryDate || '', certificateDocumentId: item.certificateDocumentId || '', skillsCovered: item.skillsCovered || '', status: item.status, notes: item.notes || '' }); }
  editCertification(item: CertificationRecord): void { if (!this.canEdit()) return; this.editingCertificationId.set(item.id); this.certificationForm.reset({ employeeId: item.employeeId, trainingId: item.trainingId || '', certificationName: item.certificationName, provider: item.provider || '', issueDate: item.issueDate || '', expiryDate: item.expiryDate || '', certificateDocumentId: item.certificateDocumentId || '', skillsCovered: item.skillsCovered || '', status: item.status }); }
  editExit(item: ExitRecord): void { if (!this.canEdit()) return; this.editingExitId.set(item.id); this.exitForm.reset({ employeeId: item.employeeId, resignationDate: item.resignationDate || '', lastWorkingDay: item.lastWorkingDay || '', reason: item.reason || '', exitChecklist: item.exitChecklist || '', assetReturnStatus: item.assetReturnStatus || '', finalSettlementStatus: item.finalSettlementStatus || '', knowledgeTransferStatus: item.knowledgeTransferStatus || '', exitInterviewNotes: item.exitInterviewNotes || '', relatedDocumentId: item.relatedDocumentId || '', status: item.status }); }

  archive(kind: HrTab, id: string): void {
    if (!this.canArchive()) return;
    const request = this.archiveRequest(kind, id);
    if (request) this.run(request, 'HR record archived.');
  }

  archiveDesignation(id: string): void { if (this.canArchive()) this.run(this.api.archiveHrDesignation(id), 'Designation archived.'); }
  archiveCertification(id: string): void { if (this.canArchive()) this.run(this.api.archiveHrCertification(id), 'Certification archived.'); }

  generateReport(): void {
    this.api.hrReport(this.reportForm.getRawValue().reportType).subscribe({
      next: (report) => this.report.set(report),
      error: () => this.error.set('HR report could not be generated.')
    });
  }

  resetDepartmentForm(): void { this.editingDepartmentId.set(null); this.departmentForm.reset({ departmentName: '', description: '', parentDepartmentId: '', organizationLevel: 'EMPLOYEES', headEmployeeId: '', status: 'ACTIVE' }); }
  resetDesignationForm(): void { this.editingDesignationId.set(null); this.designationForm.reset({ title: '', departmentId: '', organizationLevel: 'EMPLOYEES', description: '', status: 'ACTIVE' }); }
  resetEmployeeForm(): void { this.editingEmployeeId.set(null); this.employeeForm.reset({ employeeId: '', fullName: '', preferredName: '', profilePhotoDocumentId: '', email: '', phone: '', emergencyContact: '', departmentId: '', designationId: '', reportingManagerId: '', employmentType: 'FULL_TIME', dateOfJoining: '', probationStatus: 'NOT_APPLICABLE', workLocation: '', employmentStatus: 'ACTIVE', skills: '', certifications: '', relatedDocumentId: '', notes: '' }); }
  resetContactForm(): void { this.editingContactId.set(null); this.contactForm.reset({ employeeId: '', contactType: 'Emergency', contactName: '', relationship: '', phone: '', email: '', notes: '' }); }
  resetAttendanceForm(): void { this.editingAttendanceId.set(null); this.attendanceForm.reset({ employeeId: '', attendanceDate: '', status: 'PRESENT', workLocation: '', notes: '' }); }
  resetLeaveForm(): void { this.editingLeaveId.set(null); this.leaveForm.reset({ employeeId: '', leaveType: 'CASUAL_LEAVE', startDate: '', endDate: '', totalDays: 1, status: 'REQUESTED', managerId: '', approvalNotes: '', relatedTaskId: '' }); }
  resetHolidayForm(): void { this.editingHolidayId.set(null); this.holidayForm.reset({ holidayName: '', holidayDate: '', description: '', status: 'ACTIVE' }); }
  resetPayrollForm(): void { this.editingPayrollId.set(null); this.payrollForm.reset({ employeeId: '', payrollMonth: '', salaryStructure: '', basicSalary: 0, allowances: 0, deductions: 0, pf: 0, esi: 0, professionalTax: 0, tds: 0, status: 'DRAFT', linkedFinancialRecordId: '', notes: '' }); }
  resetPerformanceForm(): void { this.editingPerformanceId.set(null); this.performanceForm.reset({ employeeId: '', reviewCycle: '', goals: '', achievements: '', managerFeedback: '', employeeFeedback: '', rating: 'NOT_RATED', improvementPlan: '', reviewDate: '', reviewerId: '', relatedTaskId: '', status: 'ACTIVE' }); }
  resetTrainingForm(): void { this.editingTrainingId.set(null); this.trainingForm.reset({ trainingName: '', provider: '', completionDate: '', expiryDate: '', certificateDocumentId: '', skillsCovered: '', status: 'PLANNED', notes: '' }); }
  resetCertificationForm(): void { this.editingCertificationId.set(null); this.certificationForm.reset({ employeeId: '', trainingId: '', certificationName: '', provider: '', issueDate: '', expiryDate: '', certificateDocumentId: '', skillsCovered: '', status: 'PLANNED' }); }
  resetExitForm(): void { this.editingExitId.set(null); this.exitForm.reset({ employeeId: '', resignationDate: '', lastWorkingDay: '', reason: '', exitChecklist: '', assetReturnStatus: '', finalSettlementStatus: '', knowledgeTransferStatus: '', exitInterviewNotes: '', relatedDocumentId: '', status: 'INITIATED' }); }

  label(value: string | null | undefined): string { return value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'No information has been added yet.'; }
  employeeName(id: string | null | undefined): string { return this.employees().find((employee) => employee.id === id)?.fullName || 'No employee selected'; }
  currency(value: number | null | undefined): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  overdue(date: string | null | undefined): boolean { if (!date) return false; return new Date(date) < new Date(new Date().toDateString()); }
  print(): void { window.print(); }

  private archiveRequest(kind: HrTab, id: string): Observable<void> | null {
    if (kind === 'organization') return this.api.archiveHrDepartment(id);
    if (kind === 'employees') return this.api.archiveHrEmployee(id);
    if (kind === 'contacts') return this.api.archiveHrContact(id);
    if (kind === 'attendance') return this.api.archiveHrAttendance(id);
    if (kind === 'leave') return this.api.archiveHrLeaveRequest(id);
    if (kind === 'holidays') return this.api.archiveHrHoliday(id);
    if (kind === 'payroll') return this.api.archiveHrPayrollSummary(id);
    if (kind === 'performance') return this.api.archiveHrPerformanceReview(id);
    if (kind === 'training') return this.api.archiveHrTraining(id);
    if (kind === 'exit') return this.api.archiveHrExitRecord(id);
    return null;
  }

  private run<T>(request: Observable<T>, message: string, afterSuccess?: () => void): void {
    this.saving.set(true);
    this.error.set('');
    request.subscribe({
      next: () => { this.success.set(message); this.saving.set(false); afterSuccess?.(); this.load(); },
      error: () => { this.error.set('HR record could not be saved.'); this.saving.set(false); }
    });
  }

  private clean<T extends Record<string, unknown>>(payload: T): T {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value === '' ? undefined : value])) as T;
  }
}
