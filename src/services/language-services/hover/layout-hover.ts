import * as vscode from 'vscode';

export const STACK_LAYOUT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "stacklayout") {

			let autocapDescription: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`A Layout that arranges its children horizontally or vertically. The direction can be set by orientation property.\n`)
				.appendText(`\n\n{N}`)
				.appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/layouts/layout-containers)`)
				.appendText(`   |   `)
				.appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/modules/_ui_layouts_stack_layout_)`);

			autocapDescription.isTrusted = true;

			return new vscode.Hover(autocapDescription);
		}
	}
});

export const GRID_LAYOUT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "gridlayout") {

			let autocapDescription: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`Defines a rectangular layout area that consists of columns and rows.\n`)
				.appendText(`\n\n{N}`)
				.appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/layouts/layout-containers)`)
				.appendText(`   |   `)
				.appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/modules/_ui_layouts_grid_layout_)`);

			autocapDescription.isTrusted = true;

			return new vscode.Hover(autocapDescription);
		}
	}
});


export const ABSOLUTE_LAYOUT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "absolutelayout") {

			let autocapDescription: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`A layout that lets you specify exact locations (left/top coordinates) of its children.\n`)
				.appendText(`\n\n{N}`)
				.appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/layouts/layout-containers)`)
				.appendText(`   |   `)
				.appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/modules/_ui_layouts_absolute_layout_)`);

			autocapDescription.isTrusted = true;

			return new vscode.Hover(autocapDescription);
		}
	}
});

export const DOCK_LAYOUT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "docklayout") {

			let autocapDescription: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`A Layout that arranges its children at its outer edges, and allows its last child to take up the remaining space.\n`)
				.appendText(`\n\n{N}`)
				.appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/layouts/layout-containers)`)
				.appendText(`   |   `)
				.appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/modules/_ui_layouts_dock_layout_)`);

			autocapDescription.isTrusted = true;

			return new vscode.Hover(autocapDescription);
		}
	}
});

export const FLEXBOX_LAYOUT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "flexboxlayout") {

			let autocapDescription: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`A layout based on flexbox.\n`)
				.appendText(`\n\n{N}`)
				.appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/layouts/layout-containers)`)
				.appendText(`   |   `)
				.appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/modules/_ui_layouts_flexbox_layout_)`);

			autocapDescription.isTrusted = true;

			return new vscode.Hover(autocapDescription);
		}
	}
});

export const WRAP_LAYOUT = vscode.languages.registerHoverProvider('html', {

	provideHover(document, position, token) {

		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word.toLowerCase() == "wraplayout") {

			let autocapDescription: vscode.MarkdownString = new vscode.MarkdownString()
				.appendText(`A layout that positions children in rows or columns depending on orientation property until space is filled and then wraps them on new row or column.\n`)
				.appendText(`\n\n{N}`)
				.appendMarkdown(`  [Docs](https://docs.nativescript.org/ui/layouts/layout-containers)`)
				.appendText(`   |   `)
				.appendMarkdown(`[API Reference](https://docs.nativescript.org/api-reference/modules/_ui_layouts_wrap_layout_)`);

			autocapDescription.isTrusted = true;

			return new vscode.Hover(autocapDescription);
		}
	}
});

export const LAYOUT_HOVER_PROVIDERS = [
	STACK_LAYOUT,
	GRID_LAYOUT,
	ABSOLUTE_LAYOUT,
	DOCK_LAYOUT,
	FLEXBOX_LAYOUT,
	WRAP_LAYOUT
];