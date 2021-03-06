import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { Router } from '@angular/router';
import { DataStoreService } from '../../data-store/data-store.service';

@Component( {
	selector: 'app-admin-navbar',
	templateUrl: './admin-navbar.component.html',
	styleUrls: ['./admin-navbar.component.scss']
} )
export class AdminNavbarComponent implements OnInit {
	isCollapsed = true;

	constructor(
		public as: AuthService,
		public ds: DataStoreService,
		public router: Router
	) { }

	ngOnInit() {
	}

	public signOut = () => {
		this.as.setSignedOut();
		this.router.navigate( ['signin'] );
	}

}
