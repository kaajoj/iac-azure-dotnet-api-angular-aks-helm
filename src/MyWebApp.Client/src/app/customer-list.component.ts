import { Component, OnInit } from '@angular/core';
import { CustomerService, Customer } from './customer.service';

@Component({
  selector: 'app-customer-list',
  template: `
    <table *ngIf="customers.length; else loading">
      <tr><th>ID</th><th>Name</th></tr>
      <tr *ngFor="let c of customers">
        <td>{{c.id}}</td><td>{{c.name}}</td>
      </tr>
    </table>
    <ng-template #loading>Loading...</ng-template>
  `
})
export class CustomerListComponent implements OnInit {
  customers: Customer[] = [];
  constructor(private service: CustomerService) {}
  ngOnInit() {
    this.service.getCustomers().subscribe(data => this.customers = data);
  }
}
