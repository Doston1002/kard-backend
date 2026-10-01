import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name) private deptModel: Model<DepartmentDocument>,
  ) {}

  create(data: { name: string; description?: string }) {
    return this.deptModel.create(data);
  }

  findAll() {
    return this.deptModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string) {
    const dept = await this.deptModel.findById(id).exec();
    if (!dept) throw new NotFoundException('Bo\'lim topilmadi');
    return dept;
  }

  update(id: string, data: { name?: string; description?: string }) {
    return this.deptModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  delete(id: string) {
    return this.deptModel.findByIdAndDelete(id).exec();
  }
}
