import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AttendanceStatus } from '../../common/enums';

export type AttendanceDocument = Attendance & Document;

@Schema({ _id: false })
export class LocationPoint {
  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;
}

@Schema({ timestamps: true, collection: 'attendance' })
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  employeeId: Types.ObjectId;

  @Prop()
  checkIn?: Date;

  @Prop()
  checkOut?: Date;

  @Prop({ type: LocationPoint })
  checkInLocation?: LocationPoint;

  @Prop({ type: LocationPoint })
  checkOutLocation?: LocationPoint;

  @Prop()
  checkInDistance?: number;

  @Prop()
  checkOutDistance?: number;

  @Prop({ type: Types.ObjectId, ref: 'Photo' })
  checkInPhoto?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Photo' })
  checkOutPhoto?: Types.ObjectId;

  @Prop({ enum: AttendanceStatus, default: AttendanceStatus.ABSENT })
  status: AttendanceStatus;

  @Prop()
  comment?: string;

  @Prop()
  employeeComment?: string;

  @Prop()
  commentReason?: string;

  @Prop()
  employeeCommentAt?: Date;

  @Prop()
  date: string;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
