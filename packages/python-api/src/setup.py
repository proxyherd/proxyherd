try:
    from setuptools import setup, find_packages
except ImportError:
    from distutils.core import setup, find_packages


setup(
    name='proxyherd',
    packages=find_packages(),
    install_requires=[],
    version='1.0.0',
    description='Python API and Scrapy middlewares for ProxyHerd, the open-source super proxy manager',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    author='Rakesh',
    url='https://github.com/proxyherd/proxyherd',
    license='MIT',
    keywords=['crawler', 'crawling', 'proxyherd', 'scrapoxy', 'scrapy', 'scraper', 'scraping', 'webscraping', 'proxy'],
    classifiers=[
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Framework :: Scrapy',
    ],
)
