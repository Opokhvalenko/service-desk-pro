import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Attachment {
  id: string;
  ticketId: string;
  uploadedById: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  publicId: string;
  createdAt: string;
  uploadedBy: { id: string; fullName: string; role: string };
}

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  list(ticketId: string): Promise<Attachment[]> {
    return firstValueFrom(
      this.http.get<Attachment[]>(`${this.base}/tickets/${ticketId}/attachments`),
    );
  }

  upload(ticketId: string, file: File): Promise<Attachment> {
    const fd = new FormData();
    fd.append('file', file);
    return firstValueFrom(
      this.http.post<Attachment>(`${this.base}/tickets/${ticketId}/attachments`, fd),
    );
  }

  remove(id: string): Promise<{ success: boolean }> {
    return firstValueFrom(this.http.delete<{ success: boolean }>(`${this.base}/attachments/${id}`));
  }
}
