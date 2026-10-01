import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DepartmentDocument = Department & Document;

@Schema({ timestamps: true, collection: 'departments' })
export class Department {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description?: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
