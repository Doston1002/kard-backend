import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingsDocument = Settings & Document;

@Schema({ _id: false })
export class OfficeLocation {
  @Prop({ default: 41.310098 })
  latitude: number;

  @Prop({ default: 69.307987 })
  longitude: number;
}

@Schema({ collection: 'settings' })
export class Settings {
  @Prop({ type: OfficeLocation, default: () => ({}) })
  officeLocation: OfficeLocation;

  @Prop({ default: 100 })
  radius: number;

  @Prop({ default: 'Kompaniya' })
  companyName: string;

  @Prop()
  logo?: string;

  @Prop({ default: 'Asia/Tashkent' })
  timezone: string;

  @Prop()
  botToken?: string;

  @Prop()
  adminPhone?: string;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
