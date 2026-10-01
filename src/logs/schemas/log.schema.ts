import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Log & Document;

@Schema({ timestamps: true, collection: 'logs' })
export class Log {
  @Prop({ required: true })
  action: string;

  @Prop()
  userId?: string;

  @Prop()
  employeeId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop()
  ip?: string;
}

export const LogSchema = SchemaFactory.createForClass(Log);
