import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Observable } from 'rxjs';

export interface Customer {
  id: number;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  constructor(private http: HttpClient) {}
  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(environment.apiUrl);
  }
}
