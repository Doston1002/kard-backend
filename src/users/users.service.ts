import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from './schemas/user.schema';
import { UserRole } from '../common/enums';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const count = await this.userModel.countDocuments();
    if (count === 0) {
      const username = this.configService.get('ADMIN_USERNAME') || 'admin';
      const password = this.configService.get('ADMIN_PASSWORD') || 'admin123';
      await this.create({
        username,
        password,
        role: UserRole.SUPER_ADMIN,
        fullname: 'Super Admin',
      });
      console.log(`Default admin created: ${username}`);
    }
  }

  async create(data: { username: string; password: string; role: UserRole; fullname?: string }) {
    const hashed = await bcrypt.hash(data.password, 10);
    return this.userModel.create({ ...data, password: hashed });
  }

  findByUsername(username: string) {
    return this.userModel.findOne({ username }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).select('-password').exec();
  }

  findAll() {
    return this.userModel.find().select('-password').exec();
  }

  async update(id: string, data: Partial<User> & { password?: string }) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.userModel.findByIdAndUpdate(id, data, { new: true }).select('-password').exec();
  }

  delete(id: string) {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}
