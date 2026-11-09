# -*- coding: utf-8 -*-
################################################################################
#    Author: Don Shan
#
################################################################################
{
    'name': 'List Advanced Search',
    'version': '19.0.1.0.0',
    'category': 'Extra Tools',
    'summary': """Advanced search feature in all list views""",
    'description': """1. Enhanced field-based search capabilities, supporting common fields such as text, date/datetime, many2one, integer, boolean, and float columns.
2. Dynamic, instant search. Results appear as you type. No need to click confirm.
3. Highlighting. After searching, the column will be highlighted for easy viewing.
4. Numeric columns accept operators: >100, >=100, <100, <=100, =100, !=100.""",
    'author': 'Don Shan',
    'maintainer': 'Don Shan',
    'depends': ['web'],
    'assets': {
        'web.assets_backend': [
            'list_advanced_search/static/src/js/components/date_range/*',
            'list_advanced_search/static/src/css/list_search_bar.css',
            'list_advanced_search/static/src/js/list_render_search_bar.js',
            'list_advanced_search/static/src/xml/list_render_search_bar.xml',
        ],
    },
    'images': ['static/description/banner.png'],
    'license': 'AGPL-3',
    'installable': True,
    'auto_install': False,
    'application': False,
    'price': 9.9,
    'currency': "USD",
}
