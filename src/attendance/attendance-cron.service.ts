import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Employee, EmployeeDocument } from '../employees/schemas/employee.schema';
import { AttendanceStatus, EmployeeStatus } from '../common/enums';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async markAbsentEmployees() {
    const date = new Date().toISOString().split('T')[0];
    const activeEmployees = await this.employeeModel.find({ status: EmployeeStatus.ACTIVE }).exec();
    const todayRecords = await this.attendanceModel.find({ date }).exec();
    const checkedInIds = new Set(todayRecords.map((r) => r.employeeId.toString()));

    const absentRecords = activeEmployees
      .filter((e) => !checkedInIds.has(e._id.toString()))
      .map((e) => ({
        employeeId: e._id,
        date,
        status: AttendanceStatus.ABSENT,
      }));

    if (absentRecords.length > 0) {
      await this.attendanceModel.insertMany(absentRecords, { ordered: false }).catch(() => {});
      this.logger.log(`Marked ${absentRecords.length} employees as absent for ${date}`);
    }
  }
}
