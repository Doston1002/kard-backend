import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkSchedule, WorkScheduleDocument } from './schemas/work-schedule.schema';
import { Holiday, HolidayDocument } from './schemas/holiday.schema';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(WorkSchedule.name) private scheduleModel: Model<WorkScheduleDocument>,
    @InjectModel(Holiday.name) private holidayModel: Model<HolidayDocument>,
  ) {}

  createSchedule(data: Partial<WorkSchedule>) {
    return this.scheduleModel.create(data);
  }

  findAllSchedules() {
    return this.scheduleModel.find().exec();
  }

  async findSchedule(id: string) {
    const s = await this.scheduleModel.findById(id).exec();
    if (!s) throw new NotFoundException('Ish vaqti topilmadi');
    return s;
  }

  updateSchedule(id: string, data: Partial<WorkSchedule>) {
    return this.scheduleModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  deleteSchedule(id: string) {
    return this.scheduleModel.findByIdAndDelete(id).exec();
  }

  createHoliday(data: { name: string; date: Date; recurring?: boolean }) {
    return this.holidayModel.create(data);
  }

  findAllHolidays() {
    return this.holidayModel.find().sort({ date: 1 }).exec();
  }

  deleteHoliday(id: string) {
    return this.holidayModel.findByIdAndDelete(id).exec();
  }

  isHoliday(date: Date): Promise<boolean> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this.holidayModel.exists({ date: { $gte: start, $lte: end } }).then(Boolean);
  }

  isLate(checkInTime: Date, schedule: WorkSchedule): boolean {
    const [h, m] = schedule.lateAfter.split(':').map(Number);
    const deadline = new Date(checkInTime);
    deadline.setHours(h, m, 0, 0);
    return checkInTime > deadline;
  }

  isWeekend(date: Date, schedule: WorkSchedule): boolean {
    const dayOfWeek = date.getDay();
    return schedule.weekendDays.includes(dayOfWeek);
  }
}
