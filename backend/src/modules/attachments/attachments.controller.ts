import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../auth';
import { AttachmentsService } from './attachments.service';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('tickets/:ticketId/attachments')
  @ApiOperation({ summary: 'List attachments for a ticket' })
  list(@Param('ticketId') ticketId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attachments.list(ticketId, user);
  }

  @Post('tickets/:ticketId/attachments')
  @ApiOperation({ summary: 'Upload an attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachments.upload(ticketId, file, user);
  }

  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Delete an attachment' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attachments.remove(id, user);
  }
}
