import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { AttendanceStatus, PhotoType } from '../common/enums';
import { isWithinRadius } from '../common/utils/haversine.util';
import { SettingsService } from '../settings/settings.service';
import { EmployeesService } from '../employees/employees.service';
import { SchedulesService } from '../schedules/schedules.service';
import { PhotosService } from '../photos/photos.service';

function todayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    private settingsService: SettingsService,
    private employeesService: EmployeesService,
    private schedulesService: SchedulesService,
    private photosService: PhotosService,
  ) {}

  private async validateLocation(lat: number, lon: number) {
    const settings = await this.settingsService.get();
    const { officeLocation, radius } = settings;
    const result = isWithinRadius(
      lat, lon,
      officeLocation.latitude,
      officeLocation.longitude,
      radius,
    );
    if (!result.ok) {
      throw new BadRequestException(
        `Ofis hududidan tashqaridasiz. Masofa: ${result.distance}m (ruxsat: ${radius}m)`,
      );
    }
    return result.distance;
  }

  /** Validate check-in rules without writing to DB (used before selfie). */
  async assertCheckInAllowed(employeeId: string, lat: number, lon: number) {
    const date = todayDateStr();
    const existing = await this.attendanceModel.findOne({ employeeId, date }).exec();
    if (existing?.checkIn && existing.checkInPhoto) {
      throw new BadRequestException('Bugun allaqachon ishga kelgansiz');
    }

    await this.validateLocation(lat, lon);
    const employee = await this.employeesService.findOne(employeeId);

    if (employee.schedule) {
      const scheduleId =
        typeof employee.schedule === 'string'
          ? employee.schedule
          : (employee.schedule as any)?._id?.toString() || employee.schedule.toString();
      const schedule = await this.schedulesService.findSchedule(scheduleId);

      if (this.schedulesService.isWeekend(new Date(), schedule)) {
        throw new BadRequestException('Bugun dam olish kuni');
      }
    }
  }

  async checkIn(employeeId: string, lat: number, lon: number) {
    const date = todayDateStr();
    const existing = await this.attendanceModel.findOne({ employeeId, date }).exec();
    // Completed check-in (with photo) cannot be repeated; incomplete ones may be overwritten
    if (existing?.checkIn && existing.checkInPhoto) {
      throw new BadRequestException('Bugun allaqachon ishga kelgansiz');
    }

    const distance = await this.validateLocation(lat, lon);
    const employee = await this.employeesService.findOne(employeeId);
    let status = AttendanceStatus.PRESENT;

    if (employee.schedule) {
      const scheduleId =
        typeof employee.schedule === 'string'
          ? employee.schedule
          : (employee.schedule as any)?._id?.toString() || employee.schedule.toString();
      const schedule = await this.schedulesService.findSchedule(scheduleId);

      // Weekend check
      if (this.schedulesService.isWeekend(new Date(), schedule)) {
        throw new BadRequestException('Bugun dam olish kuni');
      }

      if (this.schedulesService.isLate(new Date(), schedule)) {
        status = AttendanceStatus.LATE;
      }
    }

    const attendance = await this.attendanceModel.findOneAndUpdate(
      { employeeId, date },
      {
        $set: {
          checkIn: new Date(),
          checkInLocation: { latitude: lat, longitude: lon },
          checkInDistance: distance,
          status,
          date,
        },
        $unset: { checkInPhoto: 1 },
      },
      { upsert: true, new: true },
    );

    return { attendance, needsPhoto: true };
  }

  /** Roll back incomplete check-in/out (no selfie yet) when user cancels. */
  async cancelIncomplete(employeeId: string, action: 'checkin' | 'checkout') {
    const date = todayDateStr();
    const attendance = await this.attendanceModel.findOne({ employeeId, date }).exec();
    if (!attendance) return;

    if (action === 'checkin' && attendance.checkIn && !attendance.checkInPhoto) {
      const keepRecord =
        !!attendance.employeeComment ||
        !!attendance.comment ||
        !!attendance.checkOut;

      if (keepRecord) {
        await this.attendanceModel.updateOne(
          { _id: attendance._id },
          {
            $unset: {
              checkIn: 1,
              checkInLocation: 1,
              checkInDistance: 1,
              checkInPhoto: 1,
            },
            $set: {
              status: attendance.checkOut
                ? AttendanceStatus.CHECKED_OUT
                : AttendanceStatus.ABSENT,
            },
          },
        );
      } else {
        await this.attendanceModel.deleteOne({ _id: attendance._id }).exec();
      }
      return;
    }

    if (action === 'checkout' && attendance.checkOut && !attendance.checkOutPhoto) {
      await this.attendanceModel.updateOne(
        { _id: attendance._id },
        {
          $unset: {
            checkOut: 1,
            checkOutLocation: 1,
            checkOutDistance: 1,
            checkOutPhoto: 1,
          },
          $set: {
            status:
              attendance.status === AttendanceStatus.LATE
                ? AttendanceStatus.LATE
                : AttendanceStatus.PRESENT,
          },
        },
      );
    }
  }

  async attachCheckInPhoto(employeeId: string, photoBuffer: Buffer) {
    const date = todayDateStr();
    const attendance = await this.attendanceModel.findOne({ employeeId, date }).exec();
    if (!attendance?.checkIn) {
      throw new BadRequestException('Avval ishga kelishni tasdiqlang');
    }

    const photo = await this.photosService.saveFromBuffer(
      photoBuffer, employeeId, PhotoType.CHECK_IN, attendance._id.toString(),
    );
    attendance.checkInPhoto = photo._id as Types.ObjectId;
    await attendance.save();
    return attendance;
  }

  /** Validate check-out rules without writing to DB (used before selfie). */
  async assertCheckOutAllowed(employeeId: string, lat: number, lon: number) {
    const date = todayDateStr();
    const attendance = await this.attendanceModel.findOne({ employeeId, date }).exec();
    if (!attendance?.checkIn) {
      throw new BadRequestException('Avval ishga kelishingiz kerak');
    }
    if (attendance.checkOut && attendance.checkOutPhoto) {
      throw new BadRequestException('Bugun allaqachon ishdan ketgansiz');
    }

    const employee = await this.employeesService.findOne(employeeId);
    if (employee.schedule) {
      const scheduleId =
        typeof employee.schedule === 'string'
          ? employee.schedule
          : (employee.schedule as any)?._id?.toString() || employee.schedule.toString();
      const schedule = await this.schedulesService.findSchedule(scheduleId);
      if (this.schedulesService.isWeekend(new Date(), schedule)) {
        throw new BadRequestException('Bugun dam olish kuni');
      }
    }

    await this.validateLocation(lat, lon);
  }

  async checkOut(employeeId: string, lat: number, lon: number) {
    const date = todayDateStr();
    const attendance = await this.attendanceModel.findOne({ employeeId, date }).exec();
    if (!attendance?.checkIn) {
      throw new BadRequestException('Avval ishga kelishingiz kerak');
    }
    if (attendance.checkOut && attendance.checkOutPhoto) {
      throw new BadRequestException('Bugun allaqachon ishdan ketgansiz');
    }

    const employee = await this.employeesService.findOne(employeeId);
    if (employee.schedule) {
      const scheduleId =
        typeof employee.schedule === 'string'
          ? employee.schedule
          : (employee.schedule as any)?._id?.toString() || employee.schedule.toString();
      const schedule = await this.schedulesService.findSchedule(scheduleId);
      if (this.schedulesService.isWeekend(new Date(), schedule)) {
        throw new BadRequestException('Bugun dam olish kuni');
      }
    }

    const distance = await this.validateLocation(lat, lon);
    await this.attendanceModel.updateOne(
      { _id: attendance._id },
      {
        $set: {
          checkOut: new Date(),
          checkOutLocation: { latitude: lat, longitude: lon },
          checkOutDistance: distance,
          status: AttendanceStatus.CHECKED_OUT,
        },
        $unset: { checkOutPhoto: 1 },
      },
    );

    const updated = await this.attendanceModel.findById(attendance._id).exec();
    return { attendance: updated, needsPhoto: true };
  }

  async attachCheckOutPhoto(employeeId: string, photoBuffer: Buffer) {
    const date = todayDateStr();
    const attendance = await this.attendanceModel.findOne({ employeeId, date }).exec();
    if (!attendance?.checkOut) {
      throw new BadRequestException('Avval ishdan ketishni tasdiqlang');
    }

    const photo = await this.photosService.saveFromBuffer(
      photoBuffer, employeeId, PhotoType.CHECK_OUT, attendance._id.toString(),
    );
    attendance.checkOutPhoto = photo._id as Types.ObjectId;
    await attendance.save();
    return attendance;
  }

  async updateComment(attendanceId: string, comment: string) {
    const attendance = await this.attendanceModel
      .findByIdAndUpdate(attendanceId, { comment }, { new: true })
      .exec();
    if (!attendance) {
      throw new NotFoundException('Attendance record topilmadi');
    }
    return attendance;
  }

  private reasonToStatus(reason: string): AttendanceStatus | null {
    const map: Record<string, AttendanceStatus> = {
      absent: AttendanceStatus.ON_LEAVE,
      business_trip: AttendanceStatus.BUSINESS_TRIP,
      sick: AttendanceStatus.SICK,
    };
    return map[reason] ?? null;
  }

  async submitEmployeeComment(employeeId: string, reason: string, comment: string) {
    const date = todayDateStr();
    const existing = await this.attendanceModel.findOne({ employeeId, date }).exec();

    const update: Record<string, unknown> = {
      employeeComment: comment.trim(),
      commentReason: reason,
      employeeCommentAt: new Date(),
      date,
    };

    const newStatus = this.reasonToStatus(reason);
    if (newStatus && (!existing?.checkIn || reason !== 'late')) {
      update.status = newStatus;
    }

    const attendance = await this.attendanceModel.findOneAndUpdate(
      { employeeId, date },
      update,
      { upsert: true, new: true },
    );

    return attendance;
  }

  getToday() {
    const date = todayDateStr();
    return this.attendanceModel
      .find({ date })
      .populate({ path: 'employeeId', populate: { path: 'department' } })
      .populate('checkInPhoto')
      .populate('checkOutPhoto')
      .sort({ checkIn: -1 })
      .exec();
  }

  getTodayForEmployee(employeeId: string) {
    return this.attendanceModel
      .findOne({ employeeId, date: todayDateStr() })
      .populate('checkInPhoto')
      .populate('checkOutPhoto')
      .exec();
  }

  getHistory(employeeId: string, from?: string, to?: string) {
    const filter: Record<string, unknown> = { employeeId };
    if (from || to) {
      filter.date = {};
      if (from) (filter.date as Record<string, string>).$gte = from;
      if (to) (filter.date as Record<string, string>).$lte = to;
    }
    return this.attendanceModel
      .find(filter)
      .populate({ path: 'employeeId', populate: { path: 'department' } })
      .populate('checkInPhoto')
      .populate('checkOutPhoto')
      .sort({ date: -1, checkIn: -1 })
      .exec();
  }

  getReport(query: { from?: string; to?: string; department?: string; status?: string }) {
    const filter: Record<string, unknown> = {};
    if (query.from || query.to) {
      filter.date = {};
      if (query.from) (filter.date as Record<string, string>).$gte = query.from;
      if (query.to) (filter.date as Record<string, string>).$lte = query.to;
    }
    if (query.status) filter.status = query.status;
    return this.attendanceModel
      .find(filter)
      .populate({ path: 'employeeId', populate: { path: 'department' } })
      .sort({ date: -1, checkIn: -1 })
      .exec();
  }

  async getDashboardStats() {
    const date = todayDateStr();
    const todayRecords = await this.attendanceModel.find({ date }).exec();
    const totalEmployees = await this.employeesService.count({ status: 'active' });

    const present = todayRecords.filter(
      (r) => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE,
    ).length;
    const late = todayRecords.filter((r) => r.status === AttendanceStatus.LATE).length;
    const checkedOut = todayRecords.filter((r) => r.checkOut).length;
    const atWork = todayRecords.filter((r) => r.checkIn && !r.checkOut).length;
    const absent = totalEmployees - present;

    return {
      date,
      totalEmployees,
      present,
      late,
      absent: Math.max(0, absent),
      atWork,
      checkedOut,
      percentage: totalEmployees > 0 ? Math.round((present / totalEmployees) * 100) : 0,
    };
  }

  getWeeklyStats() {
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return this.attendanceModel.aggregate([
      { $match: { date: { $in: dates } } },
      {
        $group: {
          _id: '$date',
          present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late', 'checked_out']] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  getMapData(date?: string) {
    const filter: Record<string, unknown> = { checkInLocation: { $exists: true } };
    if (date) filter.date = date;
    else filter.date = todayDateStr();
    return this.attendanceModel
      .find(filter)
      .populate({ path: 'employeeId', populate: { path: 'department' } })
      .select('employeeId checkInLocation checkInDistance checkIn date status')
      .exec();
  }

  async getPendingCommentsCount() {
    const count = await this.attendanceModel.countDocuments({
      employeeComment: { $exists: true, $nin: [null, ''] },
      $or: [{ comment: { $exists: false } }, { comment: null }, { comment: '' }],
    });
    return { count };
  }
}
