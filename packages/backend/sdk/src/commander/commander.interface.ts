import type {
    IProfile,
    IUserToken,
} from '@proxyherd/common';


export interface IRequestToken {
    token: string;
}


export interface IRequestUser {
    user: IUserToken;
}


export interface IRequestProfile {
    user: IProfile;
}
