/** @odoo-module */
import {ListRenderer} from "@web/views/list/list_renderer";
import {patch} from "@web/core/utils/patch";
import { debounce} from "@bus/workers/websocket_worker_utils";
import { DateRange } from "./components/date_range/date_range";

patch(ListRenderer.prototype, {
    setup() {
        super.setup();
        this.domainMap = {};
        this.selectedItem = null
        this._debouncedSearch = debounce(this._triggerSearch.bind(this), 300); // 300ms debounce
    },
    // 靜態
    // _onKeyPress(ev, name, obj) {
    //     if (ev.key === "Enter" && ev.currentTarget.value.trim() !== '') {
    //         const Domain = obj._getInputValueAndDomain(ev, name);
    //         obj._getResultData(Domain);
    //     }
    // },
    //
    // _getInputValueAndDomain(ev, name) {
    //     const inputEl = ev.currentTarget.closest('.search-input').querySelector('.input_data');
    //     const inputValue = inputEl?.value?.trim();
    //
    //     if (!inputValue) {
    //         return []; // 沒有輸入就不查
    //     }
    //     return [[name, 'ilike', inputValue]];
    // },

    //動態
    _updateDomain(name, domain) {
        if (domain.length === 0) {
            delete this.domainMap[name];
        } else {
            this.domainMap[name] = domain;
        }

        const combinedDomain = Object.values(this.domainMap).flat();
        this.env.searchModel.clearQuery();
        this.env.searchModel.splitAndAddDomain(combinedDomain);
    },


    _getResultData(Domain) {
        // if (((this.domain).length == 0) && (this.__owl__.parent.parent.props.domain[0] != null)) {
        //     this.domain = this.__owl__.parent.parent.props.domain;
        // }
        this.env.searchModel.clearQuery();
        this.domain = Domain;
        this.env.searchModel.splitAndAddDomain(Domain);
    },
    _onClick_search: function (ev, name) {
        const Domain = this._getInputValueAndDomain(ev, name);
        this._getResultData(Domain);
    },

    _onInput(ev, name) {
        const inputValue = ev.target.value.trim();
        if (inputValue === '') {
            this.env.searchModel.clearQuery();
            return;
        }
        this._debouncedSearch(ev, name);
    },

    _triggerSearch(ev, name) {
        const domain = this._getInputValueAndDomain(ev, name);
        this._updateDomain(name, domain);
        // this._getResultData(Domain);
    },

    _getInputValueAndDomain(ev, name) {
        const inputEl = ev.target; //
        const inputValue = inputEl?.value?.trim();

        if (!inputValue) {
            return [];
        }
        return [[name, 'ilike', inputValue]];
    },
    changeDate(name, date) {
        let domain = [];
        if (date.from && date.to) {
            domain = ['&', [name, '>=', date.from], [name, '<=', date.to]];
        } else if (date.from) {
            domain = [[name, '>=', date.from]];
        } else if (date.to) {
            domain = [[name, '<=', date.to]];
        }
        this._updateDomain(name, domain);
    },

    onBooleanChanged(ev, name) {
        const value = ev.target.value;
        let domain = [];

        if (value === 'true') {
            domain = [[name, '=', true]];
        } else if (value === 'false') {
            domain = [[name, '=', false]];
        }
        this._updateDomain(name, domain);
    },
    changeStateSelection(name, value) {
        const domain = [[name, 'ilike', value]];
        if (value === this.selectedItem) {
            this.selectedItem = null;
            this._updateDomain(name, []);
        } else {
            this.selectedItem = value;
            this._updateDomain(name, domain);
        }
    },

});
ListRenderer.components = {...ListRenderer.components, DateRange}