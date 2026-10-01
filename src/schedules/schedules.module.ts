import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { WorkSchedule, WorkScheduleSchema } from './schemas/work-schedule.schema';
import { Holiday, HolidaySchema } from './schemas/holiday.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkSchedule.name, schema: WorkScheduleSchema },
      { name: Holiday.name, schema: HolidaySchema },
    ]),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
