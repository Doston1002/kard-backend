import {
  Controller, Get, Post, Put, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('checkin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  checkIn(@Body() body: { employeeId: string; latitude: number; longitude: number }) {
    return this.attendanceService.checkIn(body.employeeId, body.latitude, body.longitude);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  checkOut(@Body() body: { employeeId: string; latitude: number; longitude: number }) {
    return this.attendanceService.checkOut(body.employeeId, body.latitude, body.longitude);
  }

  @Get('today')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getToday() {
    return this.attendanceService.getToday();
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getHistory(
    @Query('employeeId') employeeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getHistory(employeeId, from, to);
  }

  @Get('report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('department') department?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getReport({ from, to, department, status });
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getDashboard() {
    return this.attendanceService.getDashboardStats();
  }

  @Get('weekly')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getWeekly() {
    return this.attendanceService.getWeeklyStats();
  }

  @Get('map')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMap(@Query('date') date?: string) {
    return this.attendanceService.getMapData(date);
  }

  @Get('pending-comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getPendingComments() {
    return this.attendanceService.getPendingCommentsCount();
  }

  @Put('comment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateComment(@Body() body: { attendanceId: string; comment: string }) {
    return this.attendanceService.updateComment(body.attendanceId, body.comment);
  }
}
