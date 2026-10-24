import type { ITaskData } from '@proxyherd/common';


export interface ITaskModel extends ITaskData {
    locked: boolean;
}
