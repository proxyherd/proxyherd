import {
    FREEPROXY_META,
    FREEPROXY_TO_REFRESH_META,
} from '@proxyherd/common';
import { toMongoMeta } from './mongo/mongo.helpers';
import type { IFreeproxy } from '@proxyherd/common';


export interface IFreeproxyModel extends Omit<IFreeproxy, 'id'> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _id: string;

    nextRefreshTs: number;
}


export const
    FREEPROXY_META_MONGODB = toMongoMeta(FREEPROXY_META),
    FREEPROXY_TO_REFRESH_META_MONGODB = toMongoMeta(FREEPROXY_TO_REFRESH_META);
