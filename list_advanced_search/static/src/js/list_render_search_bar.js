import { proxy } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { serializeDate, serializeDateTime, deserializeDate, formatDate } from "@web/core/l10n/dates";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { registerTemplateProcessor } from "@web/core/templates";
import { patch } from "@web/core/utils/patch";
import { useDebounced } from "@web/core/utils/timing";
import { useBus } from "@web/core/utils/hooks";
import { parseFloat } from "@web/views/fields/parsers";
import { ListRenderer } from "@web/views/list/list_renderer";
import { DateRange } from "./components/date_range/date_range";

/** Delay (ms) between the last keystroke and the actual search. */
export const SEARCH_DEBOUNCE_DELAY = 350;

const TEXT_TYPES = new Set(["char", "text", "html", "many2one", "many2many"]);
const NUMBER_TYPES = new Set(["integer", "float", "monetary"]);
const DATE_TYPES = new Set(["date", "datetime"]);
// ">= 100", "<5", "= 12.5" ... (a plain number keeps the historical "contains" behaviour)
const NUMBER_OPERATOR_RE = /^\s*(>=|<=|!=|=|>|<)\s*(.+)$/;

const HIGHLIGHT_CLASS = "o_las_highlight";

/**
 * Insert the filter row in the *base* "web.ListRenderer" template.
 *
 * A classic `t-inherit-mode="extension"` is not enough in Odoo 19: an extension is only
 * applied to the primary templates (e.g. "account.FileUploadListRenderer" used by the
 * sale orders / invoices lists) registered *after* it in the bundle, and the assets of a
 * non-application module are always bundled after the applications and their
 * dependencies. Patching the base template when it is parsed (lazily, at first render)
 * makes every list view, whatever its js_class, get the row.
 */
registerTemplateProcessor((doc) => {
    const root = doc.documentElement;
    if (!root || root.getAttribute("t-name") !== "web.ListRenderer") {
        return;
    }
    const headerRow = root.querySelector("table > thead > tr");
    if (!headerRow || root.querySelector("[t-call='list_advanced_search.FilterRow']")) {
        return;
    }
    const call = doc.createElement("t");
    call.setAttribute("t-call", "list_advanced_search.FilterRow");
    headerRow.after(call);
});

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        // The filter bar only makes sense for the main list of an action: an x2many list
        // embedded in a form would otherwise filter the *form's* search model.
        this.advSearchEnabled = Boolean(this.env.searchModel) && !this.isX2Many;
        if (!this.advSearchEnabled) {
            return;
        }
        // Reactive state is only touched when a filter is *applied* (never on a keystroke),
        // so typing does not re-render the whole list.
        this.advState = proxy({
            filters: {}, // fieldName -> { kind, value, groupId }
            resetKeys: {}, // fieldName -> int, bumped to remount (i.e. clear) an input
        });
        this._advPendingText = {}; // fieldName -> { column, value }, not reactive on purpose
        this._advTypeCache = {};
        this._advDebouncedApply = useDebounced(
            () => this._advApplyPendingText(),
            SEARCH_DEBOUNCE_DELAY
        );
        this._advRestoreFromSearchModel();
        // Keep the inputs in sync when the user removes one of our facets from the search bar
        // (or clicks on "clear all", loads a favorite, ...).
        useBus(this.env.searchModel, "update", () => this._advSyncWithSearchModel());
    },

    //--------------------------------------------------------------------------
    // Template helpers
    //--------------------------------------------------------------------------

    // Components are referenced through getters (t-component) instead of names: list
    // renderers subclassed by other apps copy `ListRenderer.components` at load time
    // and would not know a component added later by this module.
    get advDateRangeComponent() {
        return DateRange;
    },
    get advDropdownComponent() {
        return Dropdown;
    },
    get advDropdownItemComponent() {
        return DropdownItem;
    },

    /**
     * @returns {"text"|"number"|"date"|"boolean"|"selection"|false}
     */
    getAdvSearchType(column) {
        if (column.id in this._advTypeCache) {
            return this._advTypeCache[column.id];
        }
        let type = false;
        const field = column.type === "field" && this.props.list.fields[column.name];
        if (field && !column.relatedPropertyField && column.widget !== "handle") {
            // Only stored fields: they translate to a plain SQL condition, whereas computed
            // fields with a custom _search can be arbitrarily slow.
            // display_name is the exception: its search goes through _rec_names_search.
            const stored =
                field.sortable ||
                field.name === "display_name" ||
                (field.type === "many2many" && field.searchable);
            if (stored) {
                if (TEXT_TYPES.has(field.type)) {
                    type = "text";
                } else if (NUMBER_TYPES.has(field.type)) {
                    type = "number";
                } else if (DATE_TYPES.has(field.type)) {
                    type = "date";
                } else if (field.type === "boolean") {
                    type = "boolean";
                } else if (field.type === "selection") {
                    type = "selection";
                }
            }
        }
        this._advTypeCache[column.id] = type;
        return type;
    },

    advResetKey(fieldName) {
        return `${fieldName}_${this.advState.resetKeys[fieldName] || 0}`;
    },

    advFilterValue(fieldName) {
        return this.advState.filters[fieldName]?.value;
    },

    advDateValue(fieldName, bound) {
        const value = this.advFilterValue(fieldName);
        return value && value[bound] ? deserializeDate(value[bound]) : false;
    },

    advSelectionLabel(column) {
        const value = this.advFilterValue(column.name);
        if (value === undefined) {
            return column.label;
        }
        const option = this.props.list.fields[column.name].selection.find((s) => s[0] === value);
        return option ? option[1] : column.label;
    },

    getColumnClass(column) {
        const classNames = super.getColumnClass(...arguments);
        if (this.advSearchEnabled && this.advState.filters[column.name]) {
            return `${classNames} ${HIGHLIGHT_CLASS}`;
        }
        return classNames;
    },

    getCellClass(column) {
        const classNames = super.getCellClass(...arguments);
        if (this.advSearchEnabled && this.advState.filters[column.name]) {
            return `${classNames} ${HIGHLIGHT_CLASS}`;
        }
        return classNames;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    onAdvTextInput(ev, column) {
        if (ev.isComposing) {
            // IME (e.g. Chinese pinyin) still composing: wait for compositionend
            return;
        }
        this._advPendingText[column.name] = { column, value: ev.target.value };
        this._advDebouncedApply();
    },

    onAdvTextKeydown(ev, column) {
        if (ev.key === "Enter" && !ev.isComposing) {
            ev.preventDefault();
            ev.stopPropagation();
            this._advFlushText(column, ev.target.value);
        } else if (ev.key === "Escape" && ev.target.value) {
            ev.stopPropagation();
            ev.target.value = "";
            this._advFlushText(column, "");
        }
    },

    onAdvSearchIconClick(ev, column) {
        const input = ev.currentTarget.parentElement.querySelector("input");
        this._advFlushText(column, input ? input.value : "");
    },

    onAdvDateChanged(column, { from, to }) {
        const field = this.props.list.fields[column.name];
        if (!from && !to) {
            this._advCommit({ [column.name]: null });
            return;
        }
        const serialize =
            field.type === "datetime"
                ? (d, edge) =>
                      serializeDateTime(edge === "start" ? d.startOf("day") : d.endOf("day"))
                : (d) => serializeDate(d);
        const domain = [];
        const parts = [];
        if (from) {
            domain.push([column.name, ">=", serialize(from, "start")]);
            parts.push(`≥ ${formatDate(from)}`);
        }
        if (to) {
            domain.push([column.name, "<=", serialize(to, "end")]);
            parts.push(`≤ ${formatDate(to)}`);
        }
        this._advCommit({
            [column.name]: {
                kind: "date",
                value: { from: from && serializeDate(from), to: to && serializeDate(to) },
                domain,
                description: `${column.label} ${parts.join(" ")}`,
            },
        });
    },

    onAdvBooleanChanged(ev, column) {
        const value = ev.target.value;
        if (!value) {
            this._advCommit({ [column.name]: null });
            return;
        }
        const bool = value === "true";
        this._advCommit({
            [column.name]: {
                kind: "boolean",
                value,
                domain: [[column.name, "=", bool]],
                description: `${column.label}: ${bool ? _t("Yes") : _t("No")}`,
            },
        });
    },

    onAdvSelectionSelected(column, value, label) {
        if (this.advFilterValue(column.name) === value) {
            this._advCommit({ [column.name]: null });
            return;
        }
        this._advCommit({
            [column.name]: {
                kind: "selection",
                value,
                domain: [[column.name, "=", value]],
                description: `${column.label}: ${label}`,
            },
        });
    },

    onAdvSelectionClear(column) {
        this._advCommit({ [column.name]: null });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _advFlushText(column, value) {
        this._advPendingText[column.name] = { column, value };
        this._advDebouncedApply.cancel();
        this._advApplyPendingText();
    },

    _advApplyPendingText() {
        const pending = this._advPendingText;
        this._advPendingText = {};
        const updates = {};
        for (const [fieldName, { column, value }] of Object.entries(pending)) {
            updates[fieldName] = this._advTextFilterSpec(column, value.trim());
        }
        this._advCommit(updates);
    },

    _advTextFilterSpec(column, text) {
        if (!text) {
            return null;
        }
        const field = this.props.list.fields[column.name];
        const kind = NUMBER_TYPES.has(field.type) ? "number" : "text";
        if (kind === "number") {
            const match = text.match(NUMBER_OPERATOR_RE);
            if (match) {
                let number = NaN;
                try {
                    number = parseFloat(match[2].trim());
                } catch {
                    // not a number: fall back on "contains"
                }
                if (!Number.isNaN(number)) {
                    return {
                        kind,
                        value: text,
                        domain: [[column.name, match[1], number]],
                        description: `${column.label} ${match[1]} ${match[2].trim()}`,
                    };
                }
            }
        }
        return {
            kind,
            value: text,
            domain: [[column.name, "ilike", text]],
            description: `${column.label} ${_t("contains")} "${text}"`,
        };
    },

    /**
     * Applies a batch of filter changes to the search model with a single
     * notification (=> a single reload of the list).
     *
     * Unlike `splitAndAddDomain`, this is synchronous: no domain tree parsing,
     * no description/tooltip computation (which can require field RPCs), and the
     * previous facet of the same column is *replaced* instead of piling up.
     *
     * @param {Object<string, Object|null>} updates fieldName -> filter spec (null = remove)
     */
    _advCommit(updates) {
        const searchModel = this.env.searchModel;
        const filters = this.advState.filters;
        const activeGroupIds = this._advActiveGroupIds();
        let changed = false;
        searchModel.blockNotification = true;
        try {
            for (const [fieldName, spec] of Object.entries(updates)) {
                const current = filters[fieldName];
                const currentActive = current && activeGroupIds.has(current.groupId);
                if (
                    currentActive &&
                    spec &&
                    current.kind === spec.kind &&
                    JSON.stringify(current.value) === JSON.stringify(spec.value)
                ) {
                    continue; // nothing changed (e.g. trailing space, same value re-selected)
                }
                if (!spec && !current) {
                    continue;
                }
                if (currentActive) {
                    searchModel.deactivateGroup(current.groupId);
                }
                if (spec) {
                    const groupId = searchModel.nextGroupId;
                    searchModel.createNewFilters([
                        {
                            description: spec.description,
                            domain: JSON.stringify(spec.domain),
                            invisible: "True",
                            listAdvancedSearch: {
                                field: fieldName,
                                kind: spec.kind,
                                value: spec.value,
                            },
                        },
                    ]);
                    filters[fieldName] = { kind: spec.kind, value: spec.value, groupId };
                } else {
                    delete filters[fieldName];
                }
                changed = true;
            }
        } finally {
            searchModel.blockNotification = false;
        }
        if (changed) {
            searchModel._notify();
        }
    },

    _advActiveGroupIds() {
        const { query, searchItems } = this.env.searchModel;
        const groupIds = new Set();
        for (const { searchItemId } of query) {
            const item = searchItems[searchItemId];
            if (item) {
                groupIds.add(item.groupId);
            }
        }
        return groupIds;
    },

    /** Rebuild the inputs' values from facets created earlier (e.g. back from a form view). */
    _advRestoreFromSearchModel() {
        const { query, searchItems } = this.env.searchModel;
        for (const { searchItemId } of query) {
            const item = searchItems[searchItemId];
            const meta = item && item.listAdvancedSearch;
            if (meta) {
                this.advState.filters[meta.field] = {
                    kind: meta.kind,
                    value: meta.value,
                    groupId: item.groupId,
                };
            }
        }
    },

    _advSyncWithSearchModel() {
        const filters = this.advState.filters;
        if (!Object.keys(filters).length) {
            return;
        }
        const activeGroupIds = this._advActiveGroupIds();
        for (const [fieldName, filter] of Object.entries(filters)) {
            if (!activeGroupIds.has(filter.groupId)) {
                delete filters[fieldName];
                delete this._advPendingText[fieldName];
                this.advState.resetKeys[fieldName] = (this.advState.resetKeys[fieldName] || 0) + 1;
            }
        }
    },
});
