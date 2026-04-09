import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/categories`;

  list(): Promise<AdminCategory[]> {
    return firstValueFrom(this.http.get<AdminCategory[]>(this.base));
  }

  create(dto: CreateCategoryDto): Promise<AdminCategory> {
    return firstValueFrom(this.http.post<AdminCategory>(this.base, dto));
  }

  update(id: string, dto: UpdateCategoryDto): Promise<AdminCategory> {
    return firstValueFrom(this.http.patch<AdminCategory>(`${this.base}/${id}`, dto));
  }

  deactivate(id: string): Promise<AdminCategory> {
    return firstValueFrom(this.http.delete<AdminCategory>(`${this.base}/${id}`));
  }
}
