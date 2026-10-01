import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PhotoType } from '../../common/enums';

export type PhotoDocument = Photo & Document;

@Schema({ timestamps: true, collection: 'photos' })
export class Photo {
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  employeeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Attendance' })
  attendanceId?: Types.ObjectId;

  @Prop({ enum: PhotoType, required: true })
  type: PhotoType;

  @Prop({ required: true })
  url: string;

  @Prop()
  filename?: string;
}

export const PhotoSchema = SchemaFactory.createForClass(Photo);
