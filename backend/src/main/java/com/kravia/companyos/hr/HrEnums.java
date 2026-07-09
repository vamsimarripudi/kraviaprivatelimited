package com.kravia.companyos.hr;

public final class HrEnums {
    private HrEnums() {}

    public enum OrganizationLevel {
        FOUNDER,
        BOARD_OF_DIRECTORS,
        EXECUTIVE_LEADERSHIP,
        DEPARTMENT_HEADS,
        TEAM_LEADS,
        EMPLOYEES,
        INTERNS,
        CONTRACTORS,
        ADVISORS
    }

    public enum EmploymentType {
        FOUNDER,
        DIRECTOR,
        FULL_TIME,
        PART_TIME,
        CONTRACT,
        CONSULTANT,
        ADVISOR,
        INTERN
    }

    public enum EmploymentStatus {
        ACTIVE,
        PROBATION,
        NOTICE_PERIOD,
        ON_LEAVE,
        SUSPENDED,
        RESIGNED,
        TERMINATED,
        RETIRED,
        ARCHIVED
    }

    public enum ProbationStatus {
        NOT_APPLICABLE,
        IN_PROGRESS,
        CONFIRMED,
        EXTENDED
    }

    public enum AttendanceStatus {
        PRESENT,
        ABSENT,
        LEAVE,
        WFH,
        HOLIDAY,
        HALF_DAY
    }

    public enum LeaveType {
        CASUAL_LEAVE,
        SICK_LEAVE,
        EARNED_LEAVE,
        WORK_FROM_HOME,
        COMPENSATORY_OFF,
        MATERNITY_LEAVE,
        PATERNITY_LEAVE,
        UNPAID_LEAVE
    }

    public enum LeaveStatus {
        REQUESTED,
        MANAGER_REVIEW,
        APPROVED,
        REJECTED,
        CANCELLED,
        ARCHIVED
    }

    public enum PayrollStatus {
        DRAFT,
        FINAL,
        PAID,
        ARCHIVED
    }

    public enum PerformanceRating {
        NOT_RATED,
        EXCEEDS_EXPECTATIONS,
        MEETS_EXPECTATIONS,
        NEEDS_IMPROVEMENT,
        UNSATISFACTORY
    }

    public enum TrainingStatus {
        PLANNED,
        IN_PROGRESS,
        COMPLETED,
        EXPIRED,
        ARCHIVED
    }

    public enum ExitStatus {
        INITIATED,
        IN_PROGRESS,
        CLEARED,
        FINAL_SETTLEMENT_PENDING,
        COMPLETED,
        CANCELLED,
        ARCHIVED
    }

    public enum HrReportType {
        EMPLOYEE_DIRECTORY,
        DEPARTMENT_SUMMARY,
        LEAVE_REPORT,
        ATTENDANCE_REPORT,
        PAYROLL_SUMMARY,
        PERFORMANCE_REPORT,
        TRAINING_REPORT,
        EXIT_REPORT
    }
}
