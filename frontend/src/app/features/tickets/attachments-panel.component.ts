import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  type OnChanges,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { type Attachment, AttachmentsService } from '../../core/attachments/attachments.service';
import { AuthStore } from '../../core/auth/auth.store';

const ALLOWED = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-attachments-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <mat-card appearance="outlined" class="att-card">
      <header class="att-head">
        <h2 class="section-label">
          <mat-icon>attach_file</mat-icon>
          Attachments
          <span class="count">{{ items().length }}</span>
        </h2>
      </header>

      <label
        class="drop-zone"
        [class.dragging]="dragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        @if (uploading()) {
          <mat-spinner diameter="28" />
          <span>Uploading…</span>
        } @else {
          <mat-icon class="dz-icon">cloud_upload</mat-icon>
          <span>
            <strong>Drop a file here</strong> or click to choose
          </span>
          <span class="dz-hint">JPG, PNG, WEBP, PDF · max 5 MB</span>
        }
        <input
          type="file"
          [accept]="accept"
          class="visually-hidden"
          (change)="onPick($event)"
        />
      </label>

      @if (error()) {
        <div class="att-error" role="alert">{{ error() }}</div>
      }

      @if (items().length > 0) {
        <ul class="att-list">
          @for (a of items(); track a.id) {
            <li class="att-item">
              <mat-icon class="att-icon">{{ iconFor(a.mimeType) }}</mat-icon>
              <a [href]="a.url" target="_blank" rel="noopener" class="att-name">
                {{ a.fileName }}
              </a>
              <span class="att-size">{{ formatSize(a.sizeBytes) }}</span>
              <span class="att-meta">{{ a.uploadedBy.fullName }}</span>
              @if (canDelete(a)) {
                <button
                  mat-icon-button
                  type="button"
                  (click)="remove(a)"
                  [attr.aria-label]="'Delete ' + a.fileName"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              }
            </li>
          }
        </ul>
      }
    </mat-card>
  `,
  styleUrl: './attachments-panel.component.scss',
})
export class AttachmentsPanelComponent implements OnChanges {
  readonly ticketId = input.required<string>();

  protected readonly accept = ALLOWED;
  protected readonly items = signal<Attachment[]>([]);
  protected readonly uploading = signal(false);
  protected readonly dragging = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly api = inject(AttachmentsService);
  private readonly auth = inject(AuthStore);

  ngOnChanges(): void {
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      this.items.set(await this.api.list(this.ticketId()));
    } catch (err) {
      this.error.set(this.errorMessage(err));
    }
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.upload(file);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.upload(file);
  }

  private async upload(file: File): Promise<void> {
    this.error.set(null);
    if (file.size > MAX_BYTES) {
      this.error.set('File is larger than 5 MB');
      return;
    }
    if (!ALLOWED.split(',').includes(file.type)) {
      this.error.set('File type not allowed (JPG, PNG, WEBP, PDF only)');
      return;
    }
    this.uploading.set(true);
    try {
      const created = await this.api.upload(this.ticketId(), file);
      this.items.set([created, ...this.items()]);
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async remove(att: Attachment): Promise<void> {
    if (!confirm(`Delete ${att.fileName}?`)) return;
    try {
      await this.api.remove(att.id);
      this.items.set(this.items().filter((x) => x.id !== att.id));
    } catch (err) {
      this.error.set(this.errorMessage(err));
    }
  }

  protected canDelete(att: Attachment): boolean {
    const me = this.auth.user();
    const role = this.auth.role();
    if (!me) return false;
    if (att.uploadedById === me.id) return true;
    return role === 'ADMIN' || role === 'TEAM_LEAD';
  }

  protected iconFor(mime: string): string {
    if (mime === 'application/pdf') return 'picture_as_pdf';
    if (mime.startsWith('image/')) return 'image';
    return 'insert_drive_file';
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err && 'error' in err) {
      const inner = (err as { error?: { error?: { message?: string } } }).error?.error?.message;
      if (inner) return inner;
    }
    return 'Operation failed';
  }

  // Prevent the page from opening dropped files outside the zone
  @HostListener('window:dragover', ['$event'])
  @HostListener('window:drop', ['$event'])
  preventGlobalDrop(e: DragEvent): void {
    if (e.target instanceof Element && e.target.closest('.drop-zone')) return;
    e.preventDefault();
  }
}
