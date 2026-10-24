import { ConfirmGuard } from '@proxyherd/frontend-sdk';
import { ProfileUpdateComponent } from './update/update.component';
import type { Routes } from '@angular/router';


export const routes: Routes = [
    {
        path: '',
        component: ProfileUpdateComponent,
        canDeactivate: [
            ConfirmGuard,
        ],
    },
];
