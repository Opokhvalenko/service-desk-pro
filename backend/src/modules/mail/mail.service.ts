import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from = 'noreply@service-desk-pro.com';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('MAIL_HOST') ?? 'localhost';
    const port = Number(this.config.get<string>('MAIL_PORT') ?? 1025);
    this.from = this.config.get<string>('MAIL_FROM') ?? this.from;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ignoreTLS: true,
    });
    this.logger.log(`Mailer ready (${host}:${port})`);
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }

  async send(msg: MailMessage): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html ?? `<pre>${msg.text}</pre>`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send mail to ${msg.to}: ${(err as Error).message}`);
    }
  }
}
