import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
import { Photo, PhotoDocument } from './schemas/photo.schema';
import { PhotoType } from '../common/enums';

@Injectable()
export class PhotosService {
  private uploadDir: string;

  constructor(
    @InjectModel(Photo.name) private photoModel: Model<PhotoDocument>,
    configService: ConfigService,
  ) {
    this.uploadDir = configService.get('UPLOAD_DIR') || './uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFromBuffer(
    buffer: Buffer,
    employeeId: string,
    type: PhotoType,
    attendanceId?: string,
  ) {
    const filename = `${employeeId}_${type}_${Date.now()}.jpg`;
    const filepath = path.join(this.uploadDir, filename);

    await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(filepath);

    const url = `/uploads/${filename}`;
    return this.photoModel.create({
      employeeId,
      attendanceId,
      type,
      url,
      filename,
    });
  }

  findAll(query?: { employeeId?: string; attendanceId?: string; type?: string }) {
    const filter: Record<string, unknown> = {};
    if (query?.employeeId) filter.employeeId = query.employeeId;
    if (query?.attendanceId) filter.attendanceId = query.attendanceId;
    if (query?.type) filter.type = query.type;
    return this.photoModel.find(filter).populate('employeeId').sort({ createdAt: -1 }).exec();
  }

  findById(id: string) {
    return this.photoModel.findById(id).exec();
  }
}
