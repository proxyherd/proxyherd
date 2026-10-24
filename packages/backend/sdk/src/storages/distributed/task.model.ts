import {
    TASK_DATA_META,
    TASK_VIEW_META,
} from '@proxyherd/common';
import { toMongoMeta } from './mongo/mongo.helpers';
import type { ITaskData } from '@proxyherd/common';


export interface ITaskModel extends Omit<ITaskData, 'id'> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _id: string;

    locked: boolean;
}


export const
    TASK_DATA_META_MONGODB = toMongoMeta(TASK_DATA_META),
    TASK_VIEW_META_MONGODB = toMongoMeta(TASK_VIEW_META);
