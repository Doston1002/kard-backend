import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EmployeeStatus } from '../../common/enums';

export type EmployeeDocument = Employee & Document;

@Schema({ timestamps: true, collection: 'employees' })
export class Employee {
  @Prop({ required: true })
  fullname: string;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop()
  telegramId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Department' })
  department?: Types.ObjectId;

  @Prop()
  position?: string;

  @Prop({ type: Types.ObjectId, ref: 'WorkSchedule' })
  schedule?: Types.ObjectId;

  @Prop({ enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  /** Admin yuklagan profil rasmi URL (/uploads/...) */
  @Prop()
  profilePhotoUrl?: string;

  /** Yuz deskriptori — selfie solishtirish uchun */
  @Prop({ type: [Number] })
  faceDescriptor?: number[];
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
