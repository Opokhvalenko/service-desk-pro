import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import type { EnvironmentVariables } from '../../config/env.validation';

export interface UploadedFileInfo {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
  resourceType: string;
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  onModuleInit(): void {
    cloudinary.config({
      cloud_name: this.config.get('CLOUDINARY_CLOUD_NAME', { infer: true }),
      api_key: this.config.get('CLOUDINARY_API_KEY', { infer: true }),
      api_secret: this.config.get('CLOUDINARY_API_SECRET', { infer: true }),
      secure: true,
    });
    this.logger.log('Cloudinary configured');
  }

  async upload(buffer: Buffer, folder = 'service-desk-attachments'): Promise<UploadedFileInfo> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          const r = result as UploadApiResponse;
          resolve({
            url: r.secure_url,
            publicId: r.public_id,
            bytes: r.bytes,
            format: r.format,
            resourceType: r.resource_type,
          });
        },
      );
      stream.end(buffer);
    });
  }

  async destroy(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    } catch (err) {
      this.logger.warn(`Failed to delete ${publicId}: ${(err as Error).message}`);
    }
  }
}
