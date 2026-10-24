"""Compatibility shim.

The ``scrapoxy`` Python package continues as ``proxyherd`` (community fork of Scrapoxy 4.17.4).
Importing ``scrapoxy`` still works but is deprecated; import ``proxyherd`` instead.
"""
import warnings

from proxyherd.api import ProxyHerdApi, ProxyHerdApi as ScrapoxyApi, is_proxy_online  # noqa: F401
from proxyherd.blacklist import BlacklistDownloaderMiddleware  # noqa: F401
from proxyherd.proxy import ProxyDownloaderMiddleware  # noqa: F401
from proxyherd.scale import ScaleSpiderMiddleware  # noqa: F401
from proxyherd.sticky import StickySpiderMiddleware  # noqa: F401

warnings.warn(
    "The 'scrapoxy' module is deprecated; import 'proxyherd' instead.",
    DeprecationWarning,
    stacklevel=2,
)
