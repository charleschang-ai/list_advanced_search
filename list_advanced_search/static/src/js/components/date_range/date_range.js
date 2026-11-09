import { Component, proxy, t, useProps } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { DateTimeInput } from "@web/core/datetime/datetime_input";

/**
 * Two date pickers ("from" -> "to"). Values are luxon DateTime (or false);
 * the parent decides how to serialize them (date vs datetime field).
 */
export class DateRange extends Component {
    static template = "list_advanced_search.DateRange";
    static components = { DateTimeInput };
    props = useProps({
        from: t.any().optional(),
        to: t.any().optional(),
        onChange: t.function(),
    });

    setup() {
        this.fromPlaceholder = _t("Date From");
        this.toPlaceholder = _t("Date To");
        this.state = proxy({
            from: this.props.from || false,
            to: this.props.to || false,
        });
    }

    onDateFromChanged(dateFrom) {
        this.state.from = dateFrom || false;
        this.notify();
    }

    onDateToChanged(dateTo) {
        this.state.to = dateTo || false;
        this.notify();
    }

    notify() {
        this.props.onChange({ from: this.state.from, to: this.state.to });
    }
}
