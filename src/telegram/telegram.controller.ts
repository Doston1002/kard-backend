import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response) {
    const bot = this.telegramService.getBot();
    if (bot) {
      await bot.handleUpdate(req.body);
    }
    res.sendStatus(200);
  }
}
