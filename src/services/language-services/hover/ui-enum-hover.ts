import * as vscode from 'vscode';


export const ACCURACY = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "accuracy".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies common accuracy values.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.accuracy)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const ANDROID_ACTION_BAR_VISIBILITY = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "AndroidActionBarIconVisibility".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies the visibility of the Android application bar icon.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.androidactionbariconvisibility)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const ANDROID_ACTION_BAR_POSITION = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "AndroidActionItemPosition".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies android MenuItem position.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.androidactionitemposition)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});


export const ANIMATION_CURVE = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "AnimationCurve".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Represents an animation curve type.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.animationcurve)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const AUTOCAPITALIZATION = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "AutocapitalizationType".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Represents the auto-capitalization style for a text input.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.autocapitalizationtype)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const BACKGROUND_REPEAT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "BackgroundRepeat".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies background repeat.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.backgroundrepeat)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});




export const DOCK = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "dock".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies the Dock position of a child element that is inside a DockLayout.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.dock)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const FONT_ATTRIBUTES = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "FontAttributes".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`A flag enum that represents common font attributes.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.fontattributes)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const FONT_STYLE = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "FontStyle".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies different font styles.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.fontstyle)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const FONT_WEIGHT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "FontWeight".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies different font weights.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.fontweight)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const HORIZONTAL_ALIGNMENT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "HorizontalAlignment".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`HorizontalAlignment indicates where an element should be displayed on the horizontal axis relative to the allocated layout slot of the parent element.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.horizontalalignment)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const IOS_ACTION_ITEM_POSITION = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "IOSActionItemPosition".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies iOS MenuItem position.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.iosactionitemposition)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const IMAGE_FORMAT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "ImageFormat".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Defines the recognized image formats.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.imageformat)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const KEYBOARD_TYPE = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "KeyboardType".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Represents a soft keyboard flavor.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.keyboardtype)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const NAVIGATION_BAR_VISIBILITY = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "NavigationBarVisibility".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies NavigationBar visibility mode.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.navigationbarvisibility)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const ORIENTATION = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "Orientation".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Orientation indicates a direction of a layout that can exist in a horizontal or vertical state.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.orientation)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const RETURN_KEY_TYPE = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "ReturnKeyType".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Represents the flavor of the return key on the soft keyboard.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.returnkeytype)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const STRETCH = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "Stretch".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Describes how content is resized to fill its allocated space.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.stretch)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const TEXT_ALIGNMENT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "TextAlignment".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Represents a text-align enumeration.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.textalignment)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const TEXT_DECORATION = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "TextDecoration".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies different text decorations.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.textdecoration)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const TEXT_TRANSFORM = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "TextTransform".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies different text transforms.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.texttransform)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const VERTICAL_ALIGNMENT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "VerticalAlignment".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`VerticalAlignment indicates where an element should be displayed on the horizontal axis relative to the allocated layout slot of the parent element.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.verticalalignment)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const VISIBILITY = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "Visibility".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Represents the visibility mode of a view.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.visibility)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});


export const WHITE_SPACE = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "WhiteSpace".toLowerCase()) {

			let tooltip: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Specifies different white spaces.`)
				.appendText(`\n\n{N}`)
				// .appendMarkdown(`  [Docs](https://docs.nativescript.org/angular/ui/ng-components/text-field)`)
				// .appendText(`   |   `)
				.appendMarkdown(`   [API Reference](https://docs.nativescript.org/api-reference/modules/_ui_enums_.whitespace)`);
			tooltip.isTrusted = true;

			return new vscode.Hover(tooltip);
		}
	}
});

export const UI_ENUM_PROVIDERS = [
	ACCURACY,
	ANDROID_ACTION_BAR_VISIBILITY,
	ANIMATION_CURVE,
	AUTOCAPITALIZATION,
	BACKGROUND_REPEAT,
	DOCK,
	FONT_ATTRIBUTES,
	FONT_STYLE,
	FONT_WEIGHT,
	HORIZONTAL_ALIGNMENT,
	IOS_ACTION_ITEM_POSITION,
	IMAGE_FORMAT,
	KEYBOARD_TYPE,
	NAVIGATION_BAR_VISIBILITY,
	ORIENTATION,
	RETURN_KEY_TYPE,
	STRETCH,
	TEXT_ALIGNMENT,
	TEXT_DECORATION,
	TEXT_TRANSFORM,
	VERTICAL_ALIGNMENT,
	VISIBILITY,
	WHITE_SPACE
];