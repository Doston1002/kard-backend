import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WorkScheduleDocument = WorkSchedule & Document;

@Schema({ timestamps: true, collection: 'workSchedules' })
export class WorkSchedule {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: '09:00' })
  startTime: string;

  @Prop({ required: true, default: '18:00' })
  endTime: string;

  @Prop({ default: '09:10' })
  lateAfter: string;

  @Prop({ default: '17:30' })
  earlyLeave: string;

  @Prop({ type: [Number], default: [6, 0] })
  weekendDays: number[];
}

export const WorkScheduleSchema = SchemaFactory.createForClass(WorkSchedule);
