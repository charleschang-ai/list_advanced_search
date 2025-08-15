# -*- coding: utf-8 -*-
################################################################################
#    Author: Charles
#
################################################################################
{
    'name': 'List Advanced Search',
    'version': '18.0.1.0.0',
    'category': 'Extra Tools',
    'summary': """Advanced search feature in all list views""",
    'description': """1. Enhanced field-based search capabilities, supporting common fields such as text, date/datetime, many2one, integer, boolean, and float columns.
2. Dynamic, instant search. Results appear as you type. No need to click confirm.
3. Highlighting. After searching, the column will be highlighted for easy viewing.""",
    'author': 'Charles Chang',
    'maintainer': 'Charles',
    'depends': ['web', 'purchase', 'account'],
    'assets': {
        'web.assets_backend': [
            'list_advanced_search/static/src/js/components/date_range/date_range.js',
            'list_advanced_search/static/src/js/components/date_range/date_range.xml',
            'list_advanced_search/static/src/css/list_search_bar.css',
            'list_advanced_search/static/src/js/list_render_search_bar.js',
            'list_advanced_search/static/src/xml/list_render_search_bar.xml',
        ],
    },
    'images': ['static/description/icon.png'],
    'license': 'AGPL-3',
    'installable': True,
    'auto_install': False,
    'application': False,
    'price': 5,
    'currency': "USD",
}
