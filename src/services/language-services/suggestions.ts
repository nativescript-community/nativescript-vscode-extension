import * as vscode from 'vscode';

export const IOS_SUGGESTION = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('ios.')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem('position', vscode.CompletionItemKind.Value),
				new vscode.CompletionItem('systemIcon', vscode.CompletionItemKind.Value),
			];
		}
	},
	'.'
);

const KEYBOARD_TYPE_SUGGESTION = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('keyboardType=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'email'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'phone'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'number'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'integer'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'datetime'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'url'", vscode.CompletionItemKind.Value),
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const AUTOCAPITALIZATION = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);

			if (!linePrefix.endsWith('autocapitalizationType=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'none'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'words'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'sentences'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'allCharacters'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const RETURN_KEY = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('returnKeyType=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'done'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'next'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'go'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'search'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'send'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const TAB_BACKGROUND_COLOR = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('tabBackgroundColor=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'gray'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'#FF0000'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'rgb(200,100,200)'", vscode.CompletionItemKind.Value),
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);


const SELECTED_TAB_TEXT_COLOR = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('selectedTabTextColor=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'gray'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'#FF0000'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'rgb(200,100,200)'", vscode.CompletionItemKind.Value),
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);


const TAB_TEXT_COLOR = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('tabTextColor=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'gray'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'#FF0000'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'rgb(200,100,200)'", vscode.CompletionItemKind.Value),
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);


const ORIENTATION = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('orientation=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'vertical'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'horizontal'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const FONT_STYLE = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('fontStyle=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'normal'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'italic'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);


const TEXT_ALIGNMENT = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('textAlignment=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'left'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'center'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'right'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const TEXT_DECORATION = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('textDecoration=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'none'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'underline'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'line-through'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const TEXT_TRANSFORM = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('textTransform=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'none'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'capitalize'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'uppercase'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'lowercase'", vscode.CompletionItemKind.Value),
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const DOCK = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('dock=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'top'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'left'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'right'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'bottom'", vscode.CompletionItemKind.Value),
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);


const STRETCH = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('stretch=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'aspectFit'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'none'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'fill'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'aspectFill'", vscode.CompletionItemKind.Value),
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const VISIBILITY = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('visibility=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'visible'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'collapsed'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'hidden'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const VERTICAL_ALIGNMENT = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('verticalAlignment=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'stretch'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'top'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'center'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'middle'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'bottom'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);

const HORIZONTAL_ALIGNMENT = vscode.languages.registerCompletionItemProvider(
	'html',
	{
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

			let linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('horizontalAlignment=')) {
				return undefined;
			}

			return [
				new vscode.CompletionItem("'stretch'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'center'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'left'", vscode.CompletionItemKind.Value),
				new vscode.CompletionItem("'right'", vscode.CompletionItemKind.Value)
			];
		}
	},
	'=' // triggered whenever a '.' is being typed
);


export const SUGGESTION_PROVIDERS = [
	IOS_SUGGESTION,
	KEYBOARD_TYPE_SUGGESTION,
	AUTOCAPITALIZATION,
	RETURN_KEY,
	TAB_BACKGROUND_COLOR,
	TAB_TEXT_COLOR,
	SELECTED_TAB_TEXT_COLOR,
	ORIENTATION,
	FONT_STYLE,
	TEXT_ALIGNMENT,
	TEXT_DECORATION,
	TEXT_TRANSFORM,
	DOCK,
	STRETCH,
	VISIBILITY,
	VERTICAL_ALIGNMENT,
	HORIZONTAL_ALIGNMENT
];


