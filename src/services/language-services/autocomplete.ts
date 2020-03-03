import * as vscode from 'vscode'
import { GENERIC_AUTOCOMPLETE_DESCRIPTION } from './constants';


export const AUTOCAPITALIZATION = new vscode.CompletionItem('autocapitalizationType');
AUTOCAPITALIZATION.commitCharacters = ['='];
AUTOCAPITALIZATION.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const KEYBOARD_TYPE = new vscode.CompletionItem('keyboardType');
KEYBOARD_TYPE.commitCharacters = ['='];
KEYBOARD_TYPE.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const RETURN_KEY_TYPE = new vscode.CompletionItem('returnKeyType');
RETURN_KEY_TYPE.commitCharacters = ['='];
RETURN_KEY_TYPE.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const TAB_BACKGROUND_COLOR = new vscode.CompletionItem('tabBackgroundColor');
TAB_BACKGROUND_COLOR.commitCharacters = ['='];
TAB_BACKGROUND_COLOR.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);


export const SELECTED_TAB_TEXT_COLOR = new vscode.CompletionItem('selectedTabTextColor');
SELECTED_TAB_TEXT_COLOR.commitCharacters = ['='];
SELECTED_TAB_TEXT_COLOR.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const TAB_TEXT_COLOR = new vscode.CompletionItem('tabTextColor');
TAB_TEXT_COLOR.commitCharacters = ['='];
TAB_TEXT_COLOR.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);


export const ORIENTATION = new vscode.CompletionItem('orientation');
ORIENTATION.commitCharacters = ['='];
ORIENTATION.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);


export const FONT_STYLE = new vscode.CompletionItem('fontStyle');
FONT_STYLE.commitCharacters = ['='];
FONT_STYLE.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const TEXT_ALIGNMENT = new vscode.CompletionItem('textAlignment');
TEXT_ALIGNMENT.commitCharacters = ['='];
TEXT_ALIGNMENT.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);


export const TEXT_DECORATION = new vscode.CompletionItem('textDecoration');
TEXT_DECORATION.commitCharacters = ['='];
TEXT_DECORATION.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);


export const TEXT_TRANSFORM = new vscode.CompletionItem('textTransform');
TEXT_TRANSFORM.commitCharacters = ['='];
TEXT_TRANSFORM.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const VISIBILITY = new vscode.CompletionItem('visibility');
VISIBILITY.commitCharacters = ['='];
VISIBILITY.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const VERTICAL_ALIGNMENT = new vscode.CompletionItem('verticalAlignment');
VERTICAL_ALIGNMENT.commitCharacters = ['='];
VERTICAL_ALIGNMENT.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const HORIZONTAL_ALIGNMENT = new vscode.CompletionItem('horizontalAlignment');
HORIZONTAL_ALIGNMENT.commitCharacters = ['='];
HORIZONTAL_ALIGNMENT.documentation = new vscode.MarkdownString(GENERIC_AUTOCOMPLETE_DESCRIPTION);

export const COMPLETION_PROVIDER = vscode.languages.registerCompletionItemProvider('html', {

	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {

		return [
			AUTOCAPITALIZATION,
			KEYBOARD_TYPE,
			RETURN_KEY_TYPE,
			TAB_BACKGROUND_COLOR,
			SELECTED_TAB_TEXT_COLOR,
			TAB_TEXT_COLOR,
			ORIENTATION,
			FONT_STYLE,
			TEXT_ALIGNMENT,
			TEXT_DECORATION,
			TEXT_TRANSFORM,
			VISIBILITY,
			VERTICAL_ALIGNMENT,
			HORIZONTAL_ALIGNMENT
		];

	}
});