import { EProxySellerNetworkType } from '@proxyherd/common';
import * as Joi from 'joi';


const schemaCredential = Joi.object({
    token: Joi.string()
        .required(),
});
const schemaConfig = Joi.object({
    networkType: Joi.string()
        .valid(...Object.values(EProxySellerNetworkType))
        .required(),
    country: Joi.string()
        .required(),
});


export { schemaCredential, schemaConfig };
