import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HolidayDocument = Holiday & Document;

@Schema({ timestamps: true, collection: 'holidays' })
export class Holiday {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: false })
  recurring: boolean;
}

export const HolidaySchema = SchemaFactory.createForClass(Holiday);
