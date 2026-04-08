import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { type AuthenticatedUser } from '../auth';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Magic bytes (file signatures) for whitelisted types
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (WEBP marker at offset 8)
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async list(ticketId: string, user: AuthenticatedUser) {
    await this.assertCanViewTicket(ticketId, user);
    return this.prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  async upload(ticketId: string, file: Express.Multer.File, user: AuthenticatedUser) {
    await this.assertCanViewTicket(ticketId, user);
    this.validate(file);

    const uploaded = await this.cloudinary.upload(file.buffer);
    return this.prisma.attachment.create({
      data: {
        ticketId,
        uploadedById: user.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: uploaded.url,
        publicId: uploaded.publicId,
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const att = await this.prisma.attachment.findUnique({
      where: { id },
      include: { ticket: { select: { id: true, createdById: true, assigneeId: true } } },
    });
    if (!att) throw new NotFoundException('Attachment not found');

    // Allow uploader, admin, team lead. Otherwise forbidden.
    const isOwner = att.uploadedById === user.id;
    const isPrivileged = user.role === UserRole.ADMIN || user.role === UserRole.TEAM_LEAD;
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException('Not allowed to delete this attachment');
    }

    await this.cloudinary.destroy(att.publicId);
    await this.prisma.attachment.delete({ where: { id } });
    return { success: true };
  }

  private validate(file: Express.Multer.File) {
    if (!file || !file.buffer) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`MIME type ${file.mimetype} not allowed`);
    }
    // Magic bytes check (defense against MIME spoofing)
    const detected = this.detectMime(file.buffer);
    if (!detected || detected !== file.mimetype) {
      throw new BadRequestException('File content does not match declared type');
    }
  }

  private detectMime(buffer: Buffer): string | null {
    for (const sig of MAGIC_BYTES) {
      const offset = sig.offset ?? 0;
      if (buffer.length < offset + sig.bytes.length) continue;
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[offset + i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        // For WEBP, also check the WEBP marker at offset 8
        if (sig.mime === 'image/webp') {
          const marker = buffer.slice(8, 12).toString('ascii');
          if (marker !== 'WEBP') continue;
        }
        return sig.mime;
      }
    }
    return null;
  }

  private async assertCanViewTicket(ticketId: string, user: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, createdById: true, assigneeId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEAM_LEAD) return;
    if (user.role === UserRole.REQUESTER && ticket.createdById === user.id) return;
    if (
      user.role === UserRole.AGENT &&
      (ticket.assigneeId === user.id || ticket.assigneeId === null)
    )
      return;
    throw new ForbiddenException('Not allowed to access this ticket');
  }
}
