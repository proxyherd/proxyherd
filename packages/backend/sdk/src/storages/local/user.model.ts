import type { IUserData } from '@proxyherd/common';


export interface IUserModel extends IUserData {
    projectsIds: Set<string>;
}
