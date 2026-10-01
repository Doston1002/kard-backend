export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  HR = 'hr',
}

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  SICK = 'sick',
  BUSINESS_TRIP = 'business_trip',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  CHECKED_OUT = 'checked_out',
  ABSENT = 'absent',
  ON_LEAVE = 'on_leave',
  SICK = 'sick',
  BUSINESS_TRIP = 'business_trip',
}

export enum PhotoType {
  CHECK_IN = 'check_in',
  CHECK_OUT = 'check_out',
  PROFILE = 'profile',
}
