import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup, Context } from 'telegraf';
import { EmployeesService } from '../employees/employees.service';
import { AttendanceService } from '../attendance/attendance.service';
import { FaceVerificationService } from '../face/face-verification.service';
import { AttendanceStatus } from '../common/enums';

type BotContext = Context & {
  session?: {
    step?: string;
    pendingAction?: 'checkin' | 'checkout';
    location?: { lat: number; lon: number };
    commentReason?: string;
  };
};

const COMMENT_REASONS: Record<string, { label: string; key: string }> = {
  '⏰ Kech qolaman': { label: 'Kech qolaman', key: 'late' },
  '❌ Ishga kela olmayman': { label: 'Ishga kela olmayman', key: 'absent' },
  '✈️ Xizmat safarida': { label: 'Xizmat safarida', key: 'business_trip' },
  '🤒 Kasal': { label: 'Kasal', key: 'sick' },
  '📝 Boshqa sabab': { label: 'Boshqa sabab', key: 'other' },
};

const REASON_LABELS: Record<string, string> = {
  late: 'Kech qolaman',
  absent: 'Ishga kela olmayman',
  business_trip: 'Xizmat safarida',
  sick: 'Kasal',
  other: 'Boshqa sabab',
};

const sessions = new Map<number, BotContext['session']>();

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf<BotContext>;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private configService: ConfigService,
    private employeesService: EmployeesService,
    private attendanceService: AttendanceService,
    private faceVerificationService: FaceVerificationService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === 'your-telegram-bot-token-from-botfather') {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured — bot disabled');
      return;
    }

    this.bot = new Telegraf<BotContext>(token);
    this.setupHandlers();

    const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
    if (webhookUrl) {
      await this.bot.telegram.setWebhook(`${webhookUrl}/telegram/webhook`);
      this.logger.log('Telegram webhook configured');
    } else {
      this.bot.launch().then(() => this.logger.log('Telegram bot started (polling)'));
    }
  }

  getBot() {
    return this.bot;
  }

  private commentReasonMenu() {
    return Markup.keyboard([
      ['⏰ Kech qolaman', '❌ Ishga kela olmayman'],
      ['✈️ Xizmat safarida', '🤒 Kasal'],
      ['📝 Boshqa sabab', '🔙 Asosiy menyu'],
    ]).resize();
  }

  private mainMenu() {
    return Markup.keyboard([
      ['🏢 Ishga keldim', '🚪 Ishdan ketdim'],
      ['📅 Bugungi davomat', '📜 Davomat tarixi'],
      ['👤 Profil', '📝 Izoh yozish'],
    ]).resize();
  }

  private setupHandlers() {
    this.bot.start(async (ctx) => {
      const telegramId = ctx.from?.id.toString();
      if (!telegramId) return;

      const employee = await this.employeesService.findByTelegramId(telegramId);
      if (employee) {
        await ctx.reply(
          `Xush kelibsiz, ${employee.fullname}! 👋`,
          this.mainMenu(),
        );
        return;
      }

      await ctx.reply(
        'Assalomu alaykum! Davomat tizimiga xush kelibsiz.\n\nRo\'yxatdan o\'tish uchun telefon raqamingizni yuboring:',
        Markup.keyboard([
          [Markup.button.contactRequest('📱 Telefon raqamni yuborish')],
        ]).resize(),
      );
    });

    this.bot.on('contact', async (ctx) => {
      const contact = ctx.message.contact;
      const telegramId = ctx.from?.id.toString();
      if (!contact?.phone_number || !telegramId) return;

      let phone = contact.phone_number.replace(/\s/g, '');
      if (!phone.startsWith('+')) phone = '+' + phone;

      try {
        const employee = await this.employeesService.linkTelegram(phone, telegramId);
        await ctx.reply(
          `✅ Muvaffaqiyatli ro'yxatdan o'tdingiz!\n\nSalom, ${employee.fullname}!`,
          this.mainMenu(),
        );
      } catch {
        await ctx.reply(
          '❌ Telefon raqamingiz tizimda topilmadi.\nKadrlar bo\'limiga murojaat qiling.',
        );
      }
    });

    this.bot.hears('🏢 Ishga keldim', async (ctx) => {
      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      sessions.set(ctx.from!.id, { step: 'awaiting_location', pendingAction: 'checkin' });
      await ctx.reply(
        '📍 Iltimos, hozirgi joylashuvingizni yuboring:',
        Markup.keyboard([[Markup.button.locationRequest('📍 Joylashuvni yuborish')]]).resize(),
      );
    });

    this.bot.hears('🚪 Ishdan ketdim', async (ctx) => {
      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      sessions.set(ctx.from!.id, { step: 'awaiting_location', pendingAction: 'checkout' });
      await ctx.reply(
        '📍 Iltimos, hozirgi joylashuvingizni yuboring:',
        Markup.keyboard([[Markup.button.locationRequest('📍 Joylashuvni yuborish')]]).resize(),
      );
    });

    this.bot.on('location', async (ctx) => {
      const session = sessions.get(ctx.from!.id);
      if (!session?.pendingAction || session.step !== 'awaiting_location') return;

      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      const { latitude, longitude } = ctx.message.location;
      const employeeId = employee._id.toString();

      try {
        if (session.pendingAction === 'checkin') {
          await this.attendanceService.assertCheckInAllowed(employeeId, latitude, longitude);
        } else {
          await this.attendanceService.assertCheckOutAllowed(employeeId, latitude, longitude);
        }

        sessions.set(ctx.from!.id, {
          step: 'awaiting_photo',
          pendingAction: session.pendingAction,
          location: { lat: latitude, lon: longitude },
        });
        await ctx.reply(
          '✅ Joylashuv tasdiqlandi!\n\n🤳 Endi yuzingiz ko\'rinadigan selfie yuboring:',
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
      } catch (err) {
        sessions.delete(ctx.from!.id);
        const msg = err instanceof Error ? err.message : 'Xatolik yuz berdi';
        await ctx.reply(`❌ ${msg}`, this.mainMenu());
      }
    });

    this.bot.on('photo', async (ctx) => {
      const session = sessions.get(ctx.from!.id);
      if (session?.step !== 'awaiting_photo' || !session.location) return;

      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      const photos = ctx.message.photo;
      const largest = photos[photos.length - 1];
      const fileLink = await ctx.telegram.getFileLink(largest.file_id);
      const response = await fetch(fileLink.href);
      const buffer = Buffer.from(await response.arrayBuffer());
      const employeeId = employee._id.toString();
      const { lat, lon } = session.location;

      await ctx.reply('🔍 Rasm tekshirilmoqda...');

      const verify = await this.faceVerificationService.verifySelfie(
        buffer,
        employee.faceDescriptor,
      );

      if (verify.ok === false) {
        await ctx.reply(
          `❌ ${verify.message}`,
          Markup.keyboard([['❌ Bekor qilish']]).resize(),
        );
        return;
      }

      try {
        if (session.pendingAction === 'checkin') {
          await this.attendanceService.checkIn(employeeId, lat, lon);
          await this.attendanceService.attachCheckInPhoto(employeeId, buffer);
          await ctx.reply(
            '✅ Ishga kelishingiz muvaffaqiyatli qayd etildi!\nYaxshi ish kuni tilaymiz! 💼',
            this.mainMenu(),
          );
        } else {
          await this.attendanceService.checkOut(employeeId, lat, lon);
          await this.attendanceService.attachCheckOutPhoto(employeeId, buffer);
          await ctx.reply(
            '✅ Ishdan ketishingiz muvaffaqiyatli qayd etildi!\nXayr! 👋',
            this.mainMenu(),
          );
        }
        sessions.delete(ctx.from!.id);
      } catch (err) {
        sessions.delete(ctx.from!.id);
        const msg = err instanceof Error ? err.message : 'Xatolik yuz berdi';
        await ctx.reply(`❌ ${msg}`, this.mainMenu());
      }
    });

    this.bot.hears('❌ Bekor qilish', async (ctx) => {
      const session = sessions.get(ctx.from!.id);
      const employee = await this.employeesService.findByTelegramId(ctx.from!.id.toString());

      if (employee && session?.pendingAction && session.step === 'awaiting_photo') {
        try {
          await this.attendanceService.cancelIncomplete(
            employee._id.toString(),
            session.pendingAction,
          );
        } catch {
          // ignore rollback errors — still return to main menu
        }
      }

      sessions.delete(ctx.from!.id);
      await ctx.reply('Bekor qilindi.', this.mainMenu());
    });

    this.bot.hears('📅 Bugungi davomat', async (ctx) => {
      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      const record = await this.attendanceService.getTodayForEmployee(employee._id.toString());
      if (!record) {
        await ctx.reply('📋 Bugun hali davomat qayd etilmagan.', this.mainMenu());
        return;
      }

      const statusLabels: Record<string, string> = {
        [AttendanceStatus.PRESENT]: '✅ Keldi',
        [AttendanceStatus.LATE]: '⏰ Kechikdi',
        [AttendanceStatus.CHECKED_OUT]: '🚪 Ketdi',
        [AttendanceStatus.ABSENT]: '❌ Kelmadi',
      };

      let text = `📅 Bugungi davomat — ${record.date}\n\n`;
      text += `Holat: ${statusLabels[record.status] || record.status}\n`;
      if (record.checkIn) text += `Kelish: ${new Date(record.checkIn).toLocaleTimeString('uz-UZ')}\n`;
      if (record.checkOut) text += `Ketish: ${new Date(record.checkOut).toLocaleTimeString('uz-UZ')}\n`;
      if (record.checkInDistance) text += `Masofa: ${record.checkInDistance}m\n`;

      await ctx.reply(text, this.mainMenu());
    });

    this.bot.hears('📜 Davomat tarixi', async (ctx) => {
      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      const history = await this.attendanceService.getHistory(employee._id.toString());
      if (!history.length) {
        await ctx.reply('📋 Davomat tarixi bo\'sh.', this.mainMenu());
        return;
      }

      const statusLabels: Record<string, string> = {
        present: '✅', late: '⏰', checked_out: '🚪', absent: '❌',
      };

      let text = '📜 Oxirgi 30 kun davomati:\n\n';
      for (const r of history) {
        const icon = statusLabels[r.status] || '•';
        const checkIn = r.checkIn ? new Date(r.checkIn).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '-';
        const checkOut = r.checkOut ? new Date(r.checkOut).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '-';
        text += `${icon} ${r.date} | ${checkIn} → ${checkOut}\n`;
      }

      await ctx.reply(text, this.mainMenu());
    });

    this.bot.hears('👤 Profil', async (ctx) => {
      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      const dept = employee.department as { name?: string } | undefined;
      let text = `👤 Profil\n\n`;
      text += `F.I.O: ${employee.fullname}\n`;
      text += `Telefon: ${employee.phone}\n`;
      text += `Lavozim: ${employee.position || '-'}\n`;
      text += `Bo'lim: ${dept?.name || '-'}\n`;
      text += `Holat: ${employee.status}\n`;

      await ctx.reply(text, this.mainMenu());
    });

    this.bot.hears('📝 Izoh yozish', async (ctx) => {
      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      await ctx.reply(
        'Sababni tanlang, keyin izohingizni yozing.\nIzoh admin paneliga yuboriladi.\n\n• Kech qolaman\n• Ishga kela olmayman\n• Xizmat safarida\n• Kasal\n• Boshqa sabab',
        this.commentReasonMenu(),
      );
    });

    this.bot.hears('🔙 Asosiy menyu', async (ctx) => {
      sessions.delete(ctx.from!.id);
      await ctx.reply('Asosiy menyu:', this.mainMenu());
    });

    for (const [buttonText, reason] of Object.entries(COMMENT_REASONS)) {
      this.bot.hears(buttonText, async (ctx) => {
        const employee = await this.getEmployee(ctx);
        if (!employee) return;

        sessions.set(ctx.from!.id, {
          step: 'awaiting_comment',
          commentReason: reason.key,
        });

        await ctx.reply(
          `Sabab: ${reason.label}\n\nIltimos, izohingizni yozing. Yozgan izohingiz adminga yuboriladi:`,
          Markup.keyboard([['🔙 Asosiy menyu']]).resize(),
        );
      });
    }

    this.bot.on('text', async (ctx) => {
      const session = sessions.get(ctx.from!.id);
      if (session?.step !== 'awaiting_comment' || !session.commentReason) return;

      const text = ctx.message.text.trim();
      if (!text || text === '🔙 Asosiy menyu') return;

      const employee = await this.getEmployee(ctx);
      if (!employee) return;

      if (text.length < 5) {
        await ctx.reply('Izoh juda qisqa. Kamida 5 ta belgi yozing.');
        return;
      }

      try {
        await this.attendanceService.submitEmployeeComment(
          employee._id.toString(),
          session.commentReason,
          text,
        );

        const reasonLabel = REASON_LABELS[session.commentReason] || session.commentReason;
        await ctx.reply(
          `✅ Izohingiz adminga yuborildi!\n\nSabab: ${reasonLabel}\nIzoh: ${text}`,
          this.mainMenu(),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Xatolik yuz berdi';
        await ctx.reply(`❌ ${msg}`, this.mainMenu());
      }

      sessions.delete(ctx.from!.id);
    });
  }

  private async getEmployee(ctx: BotContext) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return null;

    const employee = await this.employeesService.findByTelegramId(telegramId);
    if (!employee) {
      await ctx.reply('❌ Avval /start buyrug\'i orqali ro\'yxatdan o\'ting.');
      return null;
    }
    return employee;
  }
}
