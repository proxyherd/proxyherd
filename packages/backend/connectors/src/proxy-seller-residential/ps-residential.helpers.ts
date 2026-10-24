import type { IProxySellerGeoCountryView } from '@proxyherd/common';


export function toProxySellerGeoCountryView(i: IProxySellerGeoCountryView): IProxySellerGeoCountryView {
    const item: IProxySellerGeoCountryView = {
        code: i.code,
        name: i.name,
    };

    return item;
}
