import { ECommanderError } from '@proxyherd/common';


export class ClientError extends Error {
    constructor(
        public readonly id: ECommanderError, message: string
    ) {
        super(message);
    }
}
