import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { SchedulesModule } from './schedules/schedules.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SettingsModule } from './settings/settings.module';
import { PhotosModule } from './photos/photos.module';
import { TelegramModule } from './telegram/telegram.module';
import { FaceModule } from './face/face.module';
import { AttendanceCronService } from './attendance/attendance-cron.service';
import { Attendance, AttendanceSchema } from './attendance/schemas/attendance.schema';
import { Employee, EmployeeSchema } from './employees/schemas/employee.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/kadr',
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    EmployeesModule,
    DepartmentsModule,
    SchedulesModule,
    AttendanceModule,
    SettingsModule,
    PhotosModule,
    FaceModule,
    TelegramModule,
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  providers: [AttendanceCronService],
})
export class AppModule {}
