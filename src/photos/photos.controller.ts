import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Photos')
@Controller('photos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PhotosController {
  constructor(private photosService: PhotosService) {}

  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('attendanceId') attendanceId?: string,
    @Query('type') type?: string,
  ) {
    return this.photosService.findAll({ employeeId, attendanceId, type });
  }
}
