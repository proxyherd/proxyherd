---
# https://vitepress.dev/reference/default-theme-home-page
layout: home
title: 'Home'

hero:
  name: ProxyHerd
  text: Never be blocked. Again.
  tagline: Manage all your proxies in one place and <br/>smartly routes traffic to avoid bans.
  image:
    src: /assets/images/proxyherd-hero.png
    alt: ProxyHerd
  actions:
    - theme: brand
      text: Get Started
      link: /intro/proxyherd
    - theme: alt
      text: Discussions
      link: https://github.com/proxyherd/proxyherd/discussions
    - theme: alt
      text: View on Github|Add a Star
      link: https://github.com/proxyherd/proxyherd
      img: https://img.shields.io/github/stars/proxyherd/proxyherd?logo=github&logoColor=000000&label=Star&color=fafafa&style=social
      shiny: confetti
      typewritter: true

features:
  - icon: 🤫
    title: Private Proxies Pool
    details: Use your own cloud subscription to create a <b>private pool</b> of Datacenter proxies.
  - icon: 🏠
    title: All-in-One Providers
    details: Support a wide range of vendors for Residential, Mobile, and Hardware proxies.
  - icon: ✋
    title: Anti-Ban
    details: Smart traffic routing with <b>stickies sessions</b> for Headless Browsers
  - icon: 💰
    title: Cost Optimization
    details: Scale your proxy pool exclusively during scraping sessions to <b>cut costs by 80%</b>.
  - icon: 🛡️
    title: Secure
    details: All data is encrypted within your infrastructure, certify <b>zero data leakage</b>.
  - icon: 🤩
    title: Free & Open Source
    details: Completely free under the MIT License, with source code openly available on GitHub.

providers:
    - tier: ""
      size: 'medium'
      items:
        - name: 'AWS'
          url: 'https://aws.amazon.com'
          img: '/assets/images/aws.svg'
        - name: 'Azure'
          url: 'https://azure.microsoft.com'
          img: '/assets/images/azure.svg'
        - name: 'Bright Data'
          url: 'https://brightdata.com'
          img: '/assets/images/brightdata.svg'
        - name: 'DigitalOcean'
          url: 'https://www.digitalocean.com'
          img: '/assets/images/digitalocean.svg'
        - name: 'GCP'
          url: 'https://cloud.google.com'
          img: '/assets/images/gcp.svg'
        - name: 'Geonode'
          url: 'https://geonode.com'
          img: '/assets/images/geonode.svg'
        - name: 'HypeProxy'
          url: 'https://hypeproxy.io'
          img: '/assets/images/hypeproxy.svg'
        - name: 'IPRoyal'
          url: 'https://iproyal.com'
          img: '/assets/images/iproyal.svg'
        - name: 'NetNut'
          url: 'https://netnut.io'
          img: '/assets/images/netnut.svg'
        - name: 'Live Proxies'
          url: 'https://liveproxies.io'
          img: '/assets/images/liveproxies.svg'
        - name: 'Nimble'
          url: 'https://www.nimbleway.com'
          img: '/assets/images/nimbleway.svg'
        - name: 'Ninjas Proxy'
          url: 'https://ninjasproxy.com'
          img: '/assets/images/ninjasproxy.svg'
        - name: 'OVH'
          url: 'https://www.ovh.com'
          img: '/assets/images/ovh.svg'
        - name: 'Proxidize'
          url: 'https://proxidize.com'
          img: '/assets/images/proxidize.svg'
        - name: 'Proxy Cheap'
          url: 'https://www.proxy-cheap.com'
          img: '/assets/images/proxy-cheap.svg'
        - name: 'Proxy Seller'
          url: 'https://proxy-seller.com'
          img: '/assets/images/proxy-seller.svg'
        - name: 'Proxyrack'
          url: 'https://www.proxyrack.com'
          img: '/assets/images/proxyrack.svg'
        - name: 'Rayobyte'
          url: 'https://rayobyte.com'
          img: '/assets/images/rayobyte.svg'
        - name: 'Smartproxy'
          url: 'https://smartproxy.com'
          img: '/assets/images/smartproxy.svg'
        - name: 'Zyte'
          url: 'https://www.zyte.com'
          img: '/assets/images/zyte.svg'

---
<HomeGetStarted message="Get started in a few seconds:" icon="🚀" />
<HomeProviders message="ProxyHerd has connectors for:" icon="📎" :data="$frontmatter.providers" />

<script setup>
  import HomeGetStarted from './components/HomeGetStarted.vue';
  import HomeProviders from './components/HomeProviders.vue';
</script>
