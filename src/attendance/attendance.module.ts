import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';
import { SettingsModule } from '../settings/settings.module';
import { EmployeesModule } from '../employees/employees.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Attendance.name, schema: AttendanceSchema }]),
    SettingsModule,
    EmployeesModule,
    SchedulesModule,
    PhotosModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
