import {defineConfig} from 'vitepress'
import {fileURLToPath, URL} from 'url'

const
    title = 'ProxyHerd',
    description = 'ProxyHerd is an open-source super proxy manager: one endpoint for all your proxies. Deployed on your own infrastructure, it builds a pool of private proxies from your cloud subscription, integrates proxy vendors, checks proxy health and location, manages IP rotation and sticky sessions, and routes traffic to avoid bans. Community fork of ProxyHerd 4.17.4 (MIT).',
    iconUrl = '/assets/images/proxyherd.svg',
    url = 'https://proxyherd.github.io/proxyherd',
    githubUrl = 'https://github.com/proxyherd/proxyherd',
    discussionsUrl = 'https://github.com/proxyherd/proxyherd/discussions';

export default defineConfig({
    lang: 'en-US',
    title,
    description,
    lastUpdated: true,
    cleanUrls: true,

    base: '/proxyherd/',

    head: [
        ['link', {rel: 'icon', type: 'image/svg+xml', href: iconUrl}],
        ['meta', {property: 'og:type', content: 'website'}],
        ['meta', {property: 'og:title', content: title}],
        ['meta', {property: 'og:image', content: `${url}/assets/images/proxyherd-og.png`}],
        ['meta', {property: 'og:url', content: url}],
        ['meta', {property: 'og:description', content: description}],
        ['meta', {name: 'twitter:card', content: 'summary_large_image'}],
        ['meta', {name: 'twitter:url', content: url}],
        ['meta', {name: 'twitter:title', content: title}],
        ['meta', {name: 'twitter:description', content: description}],
        ['meta', {name: 'twitter:image', content: `${url}/assets/images/proxyherd-og.png`}],
        ['meta', {name: 'theme-color', content: '#1F7A5C'}],
    ],

    themeConfig: {
        logo: {
            light: iconUrl,
            dark: '/assets/images/proxyherd-dark.svg'
        },

        nav: [
            {text: '🏠 Home', link: '/'},
            {text: '📄 Documentation', link: '/intro/proxyherd'},
            {text: '✉️ Contact', link: discussionsUrl},
            {
                text: '📙 Resources',
                items: [
                    {text: 'Changelog', link: '/intro/changelog'},
                    {text: 'Discussions', link: discussionsUrl},
                ]
            }
        ],

        sidebar: [
            {
                text: 'Introduction',
                collapsed: false,
                base: '/intro/',
                items: [
                    {text: 'What is ProxyHerd?', link: 'proxyherd'},
                    {text: 'Getting Started', link: 'get-started'},
                    {text: 'User Interface', link: 'ui'},
                    {text: 'Q&A', link: 'qna'},
                    {text: 'Changelog', link: 'changelog'},
                    {text: 'Licence', link: 'licence'},
                ]
            },
            {
                text: 'Usage',
                collapsed: false,
                base: '/usage/',
                items: [
                    {text: 'Command line', link: 'command-line'},
                    {text: 'Environment variables', link: 'env'},
                    {text: 'Stickies Sessions', link: 'sticky'},
                    {text: 'Errors', link: 'errors'},
                ]
            },
            {
                text: 'Deployment',
                collapsed: false,
                base: '/deployment/',
                items: [
                    {text: 'Single Instance', link: 'single-instance'},
                    {text: 'Simple Cluster', link: 'simple-cluster'},
                ]
            },
            {
                text: 'Connectors',
                collapsed: false,
                base: '/connectors/',
                items: [
                    {text: 'Proxy List', link: 'freeproxies/guide'},
                    {text: 'AWS', link: 'aws/guide'},
                    {text: 'Azure', link: 'azure/guide'},
                    {text: 'Bright Data', link: 'brightdata/guide'},
                    {text: 'Digital Ocean', link: 'digitalocean/guide'},
                    {text: 'GCP', link: 'gcp/guide'},
                    {text: 'Geonode', link: 'geonode/guide'},
                    {text: 'HypeProxy', link: 'hypeproxy/guide'},
                    {
                        text: 'IP Royal',
                        collapsed: false,
                        base: '/connectors/iproyal/',
                        items: [
                            {text: 'Static IP', link: 'static/guide'},
                            {text: 'Dynamic IP', link: 'dynamic/guide'},
                        ]
                    },
                    {text: 'Live Proxies', link: 'liveproxies/guide'},
                    {text: 'NetNut', link: 'netnut/guide'},
                    {text: 'Nimble', link: 'nimbleway/guide'},
                    {text: 'Ninjas Proxy', link: 'ninjasproxy/guide'},
                    {text: 'OVH', link: 'ovh/guide'},
                    {text: 'Proxidize', link: 'proxidize/guide'},
                    {
                        text: 'Proxy-Cheap',
                        collapsed: false,
                        base: '/connectors/proxy-cheap/',
                        items: [
                            {text: 'Static IP', link: 'static/guide'},
                            {text: 'Dynamic IP', link: 'dynamic/guide'},
                        ]
                    },
                    {text: 'Proxy Rack', link: 'proxyrack/guide'},
                    {
                        text: 'Proxy-Seller',
                        collapsed: false,
                        base: '/connectors/proxy-seller/',
                        items: [
                            {text: 'Static IP', link: 'static/guide'},
                            {text: 'Dynamic IP', link: 'dynamic/guide'},
                        ]
                    },
                    {text: 'Rayobyte', link: 'rayobyte/guide'},
                    {text: 'Smartproxy', link: 'smartproxy/guide'},
                    {text: 'XProxy', link: 'xproxy/guide'},
                    {text: 'Zyte', link: 'zyte/guide'},
                ],
            },
            {
                text: 'Integration',
                collapsed: false,
                base: '/integration/',
                items: [
                    {text: 'API Reference', link: 'api-reference'},
                    {
                        text: 'Python',
                        collapsed: false,
                        base: '/integration/python/',
                        items: [
                            {text: 'HRequests', link: 'hrequests/guide'},
                            {text: 'Kameleo', link: 'kameleo/guide'},
                            {text: 'Requests', link: 'requests/guide'},
                            {text: 'ScrapeGraphAI', link: 'scrapegraphai/guide'},
                            {text: 'Scrapy', link: 'scrapy/guide'},
                            {text: 'Selenium', link: 'selenium/guide'},
                            {text: 'Splash', link: 'splash/guide'},
                        ]
                    },
                    {
                        text: 'Javascript',
                        collapsed: false,
                        base: '/integration/js/',
                        items: [
                            {text: 'Axios', link: 'axios/guide'},
                            {text: 'Crawlee', link: 'crawlee/guide'},
                            {text: 'Playwright', link: 'playwright/guide'},
                            {text: 'Puppeteer', link: 'puppeteer/guide'},
                        ]
                    },

                ]
            },
            {
                text: 'Authentication',
                collapsed: false,
                base: '/auths/',
                items: [
                    {text: 'Standard', link: 'standard/guide'},
                    {text: 'Google', link: 'google/guide'},
                    {text: 'Github', link: 'github/guide'},
                ],
            },
            {
                text: 'Architecture',
                collapsed: false,
                base: '/architecture/',
                items: [
                    {text: 'Overview', link: 'overview'},
                ]
            },
            {
                text: 'Contributing',
                collapsed: false,
                base: '/contrib/',
                items: [
                    {text: 'Guidelines', link: 'guidelines'},
                    {text: 'Installation', link: 'installation'},
                    {text: 'Structure', link: 'structure'},
                    {text: 'New Connector', link: 'connector'},
                    {text: 'Licence', link: 'licence'},
                ]
            },
        ],

        socialLinks: [
            {icon: 'github', link: githubUrl},
        ],

        footer: {
            message: 'Released under the MIT License. ProxyHerd is a community fork of ProxyHerd 4.17.4 and is not affiliated with its original author.',
            copyright: 'Copyright © 2016-2024 Fabien Vauchelles (ProxyHerd) · © 2026 ProxyHerd maintainers'
        },

        search: {
            provider: 'local'
        }
    },

    vite: {
        resolve: {
            alias: [
                {
                    find: /^.*\/VPHero\.vue$/,
                    replacement: fileURLToPath(
                        new URL('./theme/components/VPHero.vue', import.meta.url)
                    )
                },
                {
                    find: /^.*\/VPNavBarMenuLink\.vue$/,
                    replacement: fileURLToPath(
                        new URL('./theme/components/VPNavBarMenuLink.vue', import.meta.url)
                    )
                },
                {
                    find: /^.*\/VPDocAsideOutline\.vue$/,
                    replacement: fileURLToPath(
                        new URL('./theme/components/VPDocAsideOutline.vue', import.meta.url)
                    )
                }
            ]
        }
    },

    sitemap: {
        hostname: url,
    },

    ignoreDeadLinks: [
        // ignore all localhost links
        /^https?:\/\/localhost/,
    ],

    /*
    locales: {
        root: {
            label: 'English',
            lang: 'en'
        },
        fr: {
            label: 'French',
            lang: 'fr',
            link: '/fr',

            themeConfig: {
                nav: [
                    {text: '🏠 Home', link: '/'},
                    {text: '📄 Documentation', link: '/fr/docs'},
                    {text: '✉️ Contact', link: 'https://github.com/proxyherd/proxyherd/discussions'},
                    {
                        text: '📙 Resources',
                        items: [
                            {text: 'Versions', link: '/fr/releases'},
                            {text: 'Roadmap', link: '/fr/roadmap'},
                            {text: 'Discord', link: 'https://github.com/proxyherd/proxyherd/discussions'},
                            {
                                text: 'Changelog',
                                link: 'https://github.com/ghcr.io/proxyherd/proxyherd/blob/master/CHANGELOG.md'
                            },
                        ]
                    }
                ],

                sidebar: [
                    {
                        text: 'Exemples',
                        items: [
                            {text: 'Exemples', link: '/fr/markdown-examples'},
                            {text: 'Exemples d\'API d\'exécution', link: '/fr/api-examples'}
                        ]
                    }
                ],

                footer: {
                    message: 'Publié sous la licence MIT.',
                    copyright: 'Copyright © 2016-présent Fabien Vauchelles'
                }
            },
        },
    },
     */
})
