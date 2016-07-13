## Development setup
To avoid a conflict, delete the installed extension at `~/.vscode/extensions/Telerik.nativescript`.

### Windows
* In `C:/Users/<username>/.vscode/extensions/`, `git clone` this repository

### OS X/Linux
* `git clone` this repository
* Run `ln -s <path to repo> ~/.vscode/extensions/vsc-nativescript`
* You could clone it to the extensions directory if you want, but working with hidden folders in OS X can be a pain.

### Then...
* `cd` to the folder you just cloned
* Run `npm -g install gulp` and `npm install`
* Run `gulp build`


## Debugging
In VS Code, run the `launch as server` launch config - it will start the adapter as a server listening on port 4712. In your test app launch.json, include this flag at the top level: `"debugServer": "4712"`. Then you'll be able to debug the adapter in the first instance of VS Code, in its original TypeScript, using sourcemaps.

## Testing
There is a set of mocha tests which can be run with `gulp test` or with the `test` launch config. Also run `gulp tslint` to check your code against our tslint rules.

## Code
The eextension is based on [VSCode Chrome Debug Extension](https://github.com/Microsoft/vscode-chrome-debug).
