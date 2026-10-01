import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from './schemas/employee.schema';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { PhotosService } from '../photos/photos.service';
import { FaceVerificationService } from '../face/face-verification.service';
import { PhotoType } from '../common/enums';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
    private photosService: PhotosService,
    private faceVerificationService: FaceVerificationService,
  ) {}

  create(dto: CreateEmployeeDto) {
    return this.employeeModel.create(dto);
  }

  findAll(query?: { search?: string; department?: string; status?: string }) {
    const filter: Record<string, unknown> = {};
    if (query?.search) {
      filter.$or = [
        { fullname: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query?.department) filter.department = query.department;
    if (query?.status) filter.status = query.status;
    return this.employeeModel
      .find(filter)
      .select('-faceDescriptor')
      .populate('department')
      .populate('schedule')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const emp = await this.employeeModel
      .findById(id)
      .select('-faceDescriptor')
      .populate('department')
      .populate('schedule')
      .exec();
    if (!emp) throw new NotFoundException('Xodim topilmadi');
    return emp;
  }

  findByPhone(phone: string) {
    return this.employeeModel.findOne({ phone }).exec();
  }

  findByTelegramId(telegramId: string) {
    return this.employeeModel
      .findOne({ telegramId })
      .populate('department')
      .populate('schedule')
      .exec();
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const emp = await this.employeeModel
      .findByIdAndUpdate(id, dto, { new: true })
      .select('-faceDescriptor')
      .populate('department')
      .populate('schedule')
      .exec();
    if (!emp) throw new NotFoundException('Xodim topilmadi');
    return emp;
  }

  async uploadProfilePhoto(id: string, buffer: Buffer) {
    const emp = await this.employeeModel.findById(id).exec();
    if (!emp) throw new NotFoundException('Xodim topilmadi');

    if (!this.faceVerificationService.isReady()) {
      throw new BadRequestException(
        'Yuz aniqlash modeli yuklanmagan. Serverni qayta ishga tushiring.',
      );
    }

    const descriptor = await this.faceVerificationService.extractDescriptor(buffer);
    if (!descriptor) {
      throw new BadRequestException(
        'Rasmdan yuz topilmadi. Yuz aniq ko\'rinadigan rasm yuklang.',
      );
    }

    const photo = await this.photosService.saveFromBuffer(
      buffer,
      id,
      PhotoType.PROFILE,
    );

    emp.profilePhotoUrl = photo.url;
    emp.faceDescriptor = Array.from(descriptor);
    await emp.save();

    const result = emp.toObject();
    delete (result as { faceDescriptor?: number[] }).faceDescriptor;
    return result;
  }

  async linkTelegram(phone: string, telegramId: string) {
    const emp = await this.employeeModel.findOneAndUpdate(
      { phone },
      { telegramId },
      { new: true },
    );
    if (!emp) throw new NotFoundException('Telefon raqam tizimda topilmadi');
    return emp;
  }

  delete(id: string) {
    return this.employeeModel.findByIdAndDelete(id).exec();
  }

  count(filter: Record<string, unknown> = {}) {
    return this.employeeModel.countDocuments(filter).exec();
  }
}
