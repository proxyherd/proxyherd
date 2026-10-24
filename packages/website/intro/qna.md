# Questions & Answers

## General

### How to bypass Anti-Bot systems?

I recommend watching this video on how anti-bot systems work and techniques to bypass them:

<iframe width="560" height="315" src="https://www.youtube.com/embed/0S5SRT-WIUo?si=b5eBtJF6qmlOtrJo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>


### Can I access to the master without username:password (e.g. http://localhost:8888) ?

ProxyHerd typically uses a `username:password` combination to select the appropriate project 
and as a security measure to prevent unauthorized access to the master.

However, you can bypass this security layer by using the [proxy-chain](https://www.npmjs.com/package/proxy-chain) library.
    
```js
const puppeteer = require('puppeteer');
const proxyChain = require('proxy-chain');

(async() => {
    const proxyUrl = await proxyChain.anonymizeProxy({
        url: 'http://username:password@localhost:8888',
        port: 38888
    });

    // Prints something like "http://127.0.0.1:38888"
    console.log(proxyUrl);

    const browser = await puppeteer.launch({
        args: [`--proxy-server=${proxyUrl}`],
    });

    // Do your magic here...
    const page = await browser.newPage();
    await page.goto('https://www.example.com');
    await page.screenshot({ path: 'example.png' });
    await browser.close();

    // Clean up
    await proxyChain.closeAnonymizedProxy(proxyUrl, true);
})();
```


## Fingerprint

### Can I host the fingerprint server myself?

Yes, and you must: ProxyHerd ships its own fingerprint service, and every installation runs one.

The service answers the question "is this proxy online, and where is it?". Each proxy fetches it
to prove that it works, and the response carries the proxy's public IP address, its network (ASN)
and its approximate location from a local GeoIP database. Nothing is reported to a third party.

Point `FINGERPRINT_URL` at your instance (see [environment variables](/usage/env)). The service
must be reachable **through your proxies**, that is from the public internet, not only from the
machine running ProxyHerd.


### How much bandwidth does the fingerprint use?

ProxyHerd periodically sends requests to the fingerprint service, through each proxy, to verify
connectivity and collect GEO information. If a request fails, ProxyHerd stops using that proxy.

A proxy is checked again about `PROXY_REFRESH_DELAY` after its previous check finished (default
1 second, so in practice every 5 to 10 seconds). The answer is about 600 bytes; over HTTPS the
TLS handshake of each check adds several kilobytes through the proxy, over plain HTTP a check is
about one kilobyte in total.

_Example:_ with the default settings, 50 proxies produce about 1,000 checks per minute, that is
1.4 million per day; over HTTPS this is a few gigabytes of proxy traffic per day. With
`PROXY_REFRESH_DELAY=60000` (one minute) the same proxies produce about 70,000 checks per day.

```
Checks per day ≈ (# proxies + # pool entries) × 86,400 / (PROXY_REFRESH_DELAY in seconds + 5)
```

See [Sizing and proxy traffic](/deployment/fingerprint#sizing-and-proxy-traffic).


## Errors

### I've got an error `no such file or directory, open 'scrapoxy.json'` at startup

This is a standard warning that occurs during the initial launchof ProxyHerd
when the configuration file has not been created yet.

Subsequently, you may encounter the following error:

```shell
Cannot read store: ENOENT: no such file or directory, open 'scrapoxy.json' 
```


### At login, I've got the error `JwtInvalidError: JWT is invalid: JWT missing`

This error can occur for the following reasons:

1. Incorrect login/password;
2. When returning to the UI with outdated cookies, requiring a re-login;
3. If ProxyHerd is hosted on HTTP but the `FRONTEND_SECURE_COOKIE` environment variable is set to 1.


### Instances are never up

There can be multiple reasons for this error:

![Instances never up](instances_never_up.png)

#### Cause 1: Adding an existing connector to an installation

When adding a connector from a prior setup, be aware that the certificate, won't be transferred.
This discrepancy arises because ProxyHerd embeds a unique TLS certificate within the instance image to secure communication with the Master.
As a result, the certificate may not match between the existing instance and the newly integrated ProxyHerd connector.
To address this issue, it's recommended to uninstall and then reinstall the connector for proper synchronization.

#### Cause 2: Deploying a single image across multiple zones or regions

It's important to note that most cloud providers restrict the use of a image across various zones or regions.
It is recommended to perform a separate connector installation for each new zone or region you wish to operate in.

#### Cause 3: Firewall forbids ProxyHerd access to instances

ProxyHerd needs the ability to access the open port (default is 3128) on the instance.
This access facilitates the acquisition of the instance's fingerprint and enables the proper relay of traffic.
Ensure that your firewall settings include a rule that permits this access.


## Proxy

### Can I add my own proxies such as Squid with ProxyHerd?

Yes, ProxyHerd allows for the incorporation of personal proxies.
It supports proxy lists with the [free proxies connector](../connectors/freeproxies/guide) to integrate them.


### Why does ProxyHerd not support multiple IP addresses for a single instance?

In theory, it's possible with cloud providers.
We can integrate multiple IPs and network interfaces. However, it boils down to economics.
When you lease an instance, it includes a public IP at no additional cost.
Adding extra IPs incurs additional charges, and for the cheapest instances, the cost of an extra IP can be nearly as much as the instance itself.
Moreover, there's a limit on the number of extra IPs you can add to an instance type, complicating cost-effectiveness.
