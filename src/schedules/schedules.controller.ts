import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Schedules')
@Controller('schedules')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SchedulesController {
  constructor(private schedulesService: SchedulesService) {}

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.schedulesService.createSchedule(body);
  }

  @Get()
  findAll() {
    return this.schedulesService.findAllSchedules();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schedulesService.findSchedule(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.schedulesService.updateSchedule(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.schedulesService.deleteSchedule(id);
  }

  @Post('holidays')
  createHoliday(@Body() body: { name: string; date: string; recurring?: boolean }) {
    return this.schedulesService.createHoliday({ ...body, date: new Date(body.date) });
  }

  @Get('holidays/list')
  findHolidays() {
    return this.schedulesService.findAllHolidays();
  }

  @Delete('holidays/:id')
  deleteHoliday(@Param('id') id: string) {
    return this.schedulesService.deleteHoliday(id);
  }
}
