import * as vscode from 'vscode';

export const ACTIVITY_INDICATOR = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'ActivityIndicator'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a UI widget which displays a progress indicator hinting the user for some background operation running.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/components/activity-indicator)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_activity_indicator_.activityindicator)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const BUTTON = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'Button'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a Button widget.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/components/button)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_button_.button)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const LABEL = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'Label'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a text label.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/components/label)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_label_.label)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const TEXT_FIELD = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'textfield') {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents an editable single-line box.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_text_field_.textfield)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const TEXT_VIEW = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'textview') {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents an editable multi-line line box.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-view)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_text_view_.textview)`);

            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const LIST_VIEW = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'ListView'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a list view widget.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/listview)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/modules/_ui_list_view_)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const IMAGE = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'Image'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents an image widget.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/image)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_image_.image)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const PROGRESS = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'Progress'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a component capable of showing progress.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/components/progress)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_progress_.progress)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const SCROLL_VIEW = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'ScrollView'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a scrollable area that can have content that is larger than its bounds.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/scroll-view)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_scroll_view_.scrollview)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const SEARCH_BAR = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'SearchBar'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a search bar component.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/search-bar)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_search_bar_.searchbar)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const SLIDER = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'Slider'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a slider component.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/slider)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_slider_.slider)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const SWITCH = vscode.languages.registerHoverProvider('html', {
    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'Switch'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a switch component.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/switch)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_switch_.switch)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const TAB_VIEW = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'TabView'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a tab view.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/tab-view)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_tab_view_.tabview)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const TAB_VIEW_ITEM = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'TabViewItem'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a tab view entry.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/tab-view)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_tab_view_.tabviewitem)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const WEB_VIEW = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'WebView'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a WebView widget.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/components/web-view)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/modules/_ui_web_view_)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const HTML_VIEW = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'HtmlView'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a view with html content. Use this component instead WebView when you want to show just static HTML content.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/htmlview)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_html_view_.htmlview)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const LIST_PICKER = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'ListPicker'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents an list picker.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/listpicker)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_list_picker_.listpicker)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const DATE_PICKER = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'DatePicker'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents an date picker.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/date-picker)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_date_picker_.datepicker)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const TIME_PICKER = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'TimePicker'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents an time picker.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/time-picker)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_time_picker_.timepicker)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const PLACEHOLDER = vscode.languages.registerHoverProvider('html', {

    provideHover(document, position, token) {

        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        if (word.toLowerCase() === 'Placeholder'.toLowerCase()) {

            const tooltip: vscode.MarkdownString = new vscode.MarkdownString()
                .appendText(`Represents a Placeholder, which is used to add a native view to the visual tree.\n`)
                .appendText(`\n\n{N}`)
                .appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/placeholder)`)
                .appendText(`   |   `)
                .appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/classes/_ui_placeholder_.placeholder)`);
            tooltip.isTrusted = true;

            return new vscode.Hover(tooltip);
        }
    },
});

export const WIDGET_HOVER_PROVIDERS = [
    ACTIVITY_INDICATOR,
    BUTTON,
    LABEL,
    TEXT_FIELD,
    TEXT_VIEW,
    LIST_VIEW,
    IMAGE,
    PROGRESS,
    SCROLL_VIEW,
    SEARCH_BAR,
    SLIDER,
    SWITCH,
    TAB_VIEW,
    TAB_VIEW_ITEM,
    WEB_VIEW,
    HTML_VIEW,
    LIST_PICKER,
    DATE_PICKER,
    TIME_PICKER,
    PLACEHOLDER,
];
