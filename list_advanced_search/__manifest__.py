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
    'description': """It enhances user experience by enabling both single and 
    multiple search capabilities across all tree view displays. It facilitates 
    multiple search filters on single columns, allowing users to easily search 
    through various data types such as text, date/datetime, many2one, integer, 
    and float columns.""",
    'author': 'Charles',
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
    'images': ['static/description/banner.jpg'],
    'license': 'AGPL-3',
    'installable': True,
    'auto_install': False,
    'application': False,
}
