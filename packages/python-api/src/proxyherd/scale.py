from scrapy import signals
from proxyherd.api import ProxyHerdApi
from time import sleep


class ScaleSpiderMiddleware(object):

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler)

    def __init__(self, crawler):
        api = crawler.settings.get("PROXYHERD_API", crawler.settings.get("SCRAPOXY_API"))
        assert api, "PROXYHERD_API is required"

        username = crawler.settings.get("PROXYHERD_USERNAME", crawler.settings.get("SCRAPOXY_USERNAME"))
        assert username, "PROXYHERD_USERNAME is required"

        password = crawler.settings.get("PROXYHERD_PASSWORD", crawler.settings.get("SCRAPOXY_PASSWORD"))
        assert password, "PROXYHERD_PASSWORD is required"

        self._api = ProxyHerdApi(api, username, password)

        self._delay = crawler.settings.get("PROXYHERD_WAIT_FOR_SCALE", crawler.settings.get("SCRAPOXY_WAIT_FOR_SCALE", 120))

        crawler.signals.connect(self.spider_opened, signals.spider_opened)
        crawler.signals.connect(self.spider_closed, signals.spider_closed)


    def spider_opened(self, spider):
        spider.logger.info("[ScaleSpiderMiddleware] Upscale ProxyHerd")

        self._api.set_project_status("HOT")

        spider.logger.info("[ScaleSpiderMiddleware] Sleeping %d seconds to finish upscale" % self._delay)
        sleep(self._delay)


    def spider_closed(self, spider):
        spider.logger.info("[ScaleSpiderMiddleware] Downscale ProxyHerd")

        self._api.set_project_status("OFF")
