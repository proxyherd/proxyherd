import type { IWindow } from '@proxyherd/common';


export interface IWindowModel extends Omit<IWindow, 'id'>{
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _id: string;
}
