import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument } from './schemas/settings.schema';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
  ) {}

  async onModuleInit() {
    const count = await this.settingsModel.countDocuments();
    if (count === 0) {
      await this.settingsModel.create({});
    }
  }

  async get() {
    let settings = await this.settingsModel.findOne().exec();
    if (!settings) {
      settings = await this.settingsModel.create({});
    }
    return settings;
  }

  update(data: Partial<Settings>) {
    return this.settingsModel.findOneAndUpdate({}, data, { new: true, upsert: true }).exec();
  }
}
