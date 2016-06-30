/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

 /* tslint:disable */

import * as Path from 'path';
import * as URL from 'url';
import * as FS from 'fs';
import {SourceMapConsumer} from 'source-map';
import * as PathUtils from './pathUtilities';
import * as utils from '../../utilities';
import {Logger} from '../../utilities';


export interface MappingResult {
	path: string;
	line: number;
	column: number;
}

export interface ISourceMaps {
	/*
	 * Map source language path to generated path.
	 * Returns null if not found.
	 */
	MapPathFromSource(path: string): string;

	/*
	 * Map location in source language to location in generated code.
	 * line and column are 0 based.
	 */
	MapFromSource(path: string, line: number, column: number): MappingResult;

	/*
	 * Map location in generated code to location in source language.
	 * line and column are 0 based.
	 */
	MapToSource(path: string, line: number, column: number): MappingResult;

    /*
     * Get all the sources that map to this generated file
     */
    AllMappedSources(path: string): string[];

    /**
     * With a known sourceMapURL for a generated script, process create the SourceMap and cache for later
     */
    ProcessNewSourceMap(path: string, sourceMapURL: string): Promise<void>;

    FindSourceMapUrlInFile(generatedFilePath: string): string;
}


export class SourceMaps implements ISourceMaps {

	public static TRACE = false;

	private static SOURCE_MAPPING_MATCHER = new RegExp("//[#@] ?sourceMappingURL=(.+)$");

	private _generatedToSourceMaps:  { [id: string] : SourceMap; } = {};		// generated -> source file
	private _sourceToGeneratedMaps:  { [id: string] : SourceMap; } = {};		// source file -> generated

    /* Path to resolve / paths against */
    private _webRoot: string;

	public constructor(webRoot: string) {
        this._webRoot = webRoot;
	}

	public MapPathFromSource(pathToSource: string): string {
		var map = this._findSourceToGeneratedMapping(pathToSource);
		if (map)
			return map.generatedPath();
		return null;
	}

	public MapFromSource(pathToSource: string, line: number, column: number): MappingResult {
		const map = this._findSourceToGeneratedMapping(pathToSource);
		if (map) {
			line += 1;	// source map impl is 1 based
			const mr = map.generatedPositionFor(pathToSource, line, column, Bias.LEAST_UPPER_BOUND);
			if (typeof mr.line === 'number') {
				if (SourceMaps.TRACE) console.error(`${Path.basename(pathToSource)} ${line}:${column} -> ${mr.line}:${mr.column}`);
				return { path: map.generatedPath(), line: mr.line-1, column: mr.column};
			}
		}
		return null;
	}

	public MapToSource(pathToGenerated: string, line: number, column: number): MappingResult {
		const map = this._generatedToSourceMaps[pathToGenerated];
		if (map) {
			line += 1;	// source map impl is 1 based
			const mr = map.originalPositionFor(line, column);
			if (mr.source) {
				if (SourceMaps.TRACE) console.error(`${Path.basename(pathToGenerated)} ${line}:${column} -> ${mr.line}:${mr.column}`);
				return { path: mr.source, line: mr.line-1, column: mr.column};
			}
		}
		return null;
	}

    public AllMappedSources(pathToGenerated: string): string[] {
        const map = this._generatedToSourceMaps[pathToGenerated];
		return map ? map.sources : null;
    }

    public ProcessNewSourceMap(pathToGenerated: string, sourceMapURL: string): Promise<void> {
        return this._findGeneratedToSourceMapping(pathToGenerated, sourceMapURL).then(() => { });
    }

	//---- private -----------------------------------------------------------------------

    private _findSourceToGeneratedMapping(pathToSource: string): SourceMap {

        if (!pathToSource) {
            return null;
        }

        if (pathToSource in this._sourceToGeneratedMaps) {
            return this._sourceToGeneratedMaps[pathToSource];
        }

        // a reverse lookup: in all source maps try to find pathToSource in the sources array
        for (let key in this._generatedToSourceMaps) {
            const m = this._generatedToSourceMaps[key];
            if (m.doesOriginateFrom(pathToSource)) {
                this._sourceToGeneratedMaps[pathToSource] = m;
                return m;
            }
        }

        //try finding a map file next to the source file
        let generatedFilePath = null;
        const pos = pathToSource.lastIndexOf('.');
        if (pos >= 0) {
            generatedFilePath = pathToSource.substr(0, pos) + '.js';
        }

        if (FS.existsSync(generatedFilePath)) {
            let parsedSourceMap = this.findGeneratedToSourceMappingSync(generatedFilePath);
            if (parsedSourceMap) {
                if (parsedSourceMap.doesOriginateFrom(pathToSource)) {
                    this._sourceToGeneratedMaps[pathToSource] = parsedSourceMap;
                    return parsedSourceMap;
                }
            }
        }

        //try finding all js files in app root and parse their source maps
        let files = this.walkPath(this._webRoot);
        files.forEach(file => {
            let parsedSourceMap = this.findGeneratedToSourceMappingSync(file);
            if (parsedSourceMap) {
                if (parsedSourceMap.doesOriginateFrom(pathToSource)) {
                    this._sourceToGeneratedMaps[pathToSource] = parsedSourceMap;
                    return parsedSourceMap;
                }
            }
        });


        // let module_files = this.walkPath(Path.join(this._webRoot, "node_modules"));
        // module_files.forEach(file => {
        //     let parsedSourceMap =  this.findGeneratedToSourceMappingSync(file);
        //     if (parsedSourceMap)
        //     {
        //         if (parsedSourceMap.doesOriginateFrom(pathToSource))
        //         {
        //             this._sourceToGeneratedMaps[pathToSource] = parsedSourceMap;
        //             return parsedSourceMap;
        //         }
        //     }
        // });

        return null;
        // not found in existing maps
    }

    /**
	 * try to find the 'sourceMappingURL' in the file with the given path.
	 * Returns null in case of errors.
	 */
    public FindSourceMapUrlInFile(generatedFilePath: string): string {

        try {
            const contents = FS.readFileSync(generatedFilePath).toString();
            const lines = contents.split('\n');
            for (let line of lines) {
                const matches = SourceMaps.SOURCE_MAPPING_MATCHER.exec(line);
                if (matches && matches.length === 2) {
                    const uri = matches[1].trim();
                    Logger.log(`_findSourceMapUrlInFile: source map url at end of generated file '${generatedFilePath}''`);
                    return uri;
                }
            }
        } catch (e) {
            // ignore exception
        }
        return null;
    }

    private walkPath(path: string): string[] {
        var results = [];
        var list = FS.readdirSync(path);
        list.forEach(file => {
            file = Path.join(path, file);
            var stat = FS.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(this.walkPath(file));
            }
            else {
                results.push(file);
            }
        });

        return results
    }

    // /**
	//  * Loads source map from file system.
	//  * If no generatedPath is given, the 'file' attribute of the source map is used.
	//  */
	// private _loadSourceMap(map_path: string, generatedPath?: string): SourceMap {

	// 	if (map_path in this._allSourceMaps) {
	// 		return this._allSourceMaps[map_path];
	// 	}

	// 	try {
	// 		const mp = Path.join(map_path);
	// 		const contents = FS.readFileSync(mp).toString();

	// 		const map = new SourceMap(mp, generatedPath, contents);
	// 		this._allSourceMaps[map_path] = map;

	// 		this._registerSourceMap(map);

	// 		Logger.log(`_loadSourceMap: successfully loaded source map '${map_path}'`);

	// 		return map;
	// 	}
	// 	catch (e) {
	// 		Logger.log(`_loadSourceMap: loading source map '${map_path}' failed with exception: ${e}`);
	// 	}
	// 	return null;
	// }

    // private _registerSourceMap(map: SourceMap) {
	// 	const gp = map.generatedPath();
	// 	if (gp) {
	// 		this._generatedToSourceMaps[gp] = map;
	// 	}
	// }

    /**
     * pathToGenerated - an absolute local path or a URL.
     * mapPath - a path relative to pathToGenerated.
     */
	private _findGeneratedToSourceMapping(generatedFilePath: string, mapPath: string): Promise<SourceMap> {
		if (!generatedFilePath) {
            return Promise.resolve(null);
        }

        if (generatedFilePath in this._generatedToSourceMaps) {
            return Promise.resolve(this._generatedToSourceMaps[generatedFilePath]);
        }

       let parsedSourceMap = this.parseInlineSourceMap(mapPath, generatedFilePath);
       if (parsedSourceMap)
       {
           return Promise.resolve(parsedSourceMap);
       }

        // if path is relative make it absolute
        if (!Path.isAbsolute(mapPath)) {
            if (Path.isAbsolute(generatedFilePath)) {
                // runtime script is on disk, so map should be too
                mapPath = PathUtils.makePathAbsolute(generatedFilePath, mapPath);
            } else {
                // runtime script is not on disk, construct the full url for the source map
                const scriptUrl = URL.parse(generatedFilePath);
                mapPath = `${scriptUrl.protocol}//${scriptUrl.host}${Path.dirname(scriptUrl.pathname)}/${mapPath}`;
            }
        }

        return this._createSourceMap(mapPath, generatedFilePath).then(map => {
            if (!map) {
                const mapPathNextToSource = generatedFilePath + ".map";
                if (mapPathNextToSource !== mapPath) {
                    return this._createSourceMap(mapPathNextToSource, generatedFilePath);
                }
            }

            return map;
        }).then(map => {
            if (map) {
                this._generatedToSourceMaps[generatedFilePath] = map;
            }

            return map || null;
        });
	}


    /**
     * generatedFilePath - an absolute local path to the generated file
     * returns the SourceMap parsed from inlined value or from a map file available next to the generated file
     */
    private findGeneratedToSourceMappingSync(generatedFilePath: string): SourceMap {
        if (!generatedFilePath) {
            return null;
        }

        if (generatedFilePath in this._generatedToSourceMaps) {
            return this._generatedToSourceMaps[generatedFilePath];
        }

        let sourceMapUrlValue = this.FindSourceMapUrlInFile(generatedFilePath);
        if (!sourceMapUrlValue)
        {
            return null;
        }

        let parsedSourceMap = this.parseInlineSourceMap(sourceMapUrlValue, generatedFilePath);
        if (parsedSourceMap) {
            return parsedSourceMap;
        }

        if (!FS.existsSync(generatedFilePath)) {
            Logger.log("findGeneratedToSourceMappingSync: can't find the sourceMapping for file: " + generatedFilePath);
            return null;
        }

        // if path is relative make it absolute
        if (!Path.isAbsolute(sourceMapUrlValue)) {
            if (Path.isAbsolute(generatedFilePath)) {
                // runtime script is on disk, so map should be too
                sourceMapUrlValue = PathUtils.makePathAbsolute(generatedFilePath, sourceMapUrlValue);
            } else {
                // runtime script is not on disk, construct the full url for the source map
                // const scriptUrl = URL.parse(generatedFilePath);
                // mapPath = `${scriptUrl.protocol}//${scriptUrl.host}${Path.dirname(scriptUrl.pathname)}/${mapPath}`;

                return null;
            }
        }

       let map = this._createSourceMapSync(sourceMapUrlValue, generatedFilePath);
       if (!map) {
            const mapPathNextToSource = generatedFilePath + ".map";
            if (mapPathNextToSource !== sourceMapUrlValue) {
                map = this._createSourceMapSync(mapPathNextToSource, generatedFilePath);
            }
        }

        if (map) {
            this._generatedToSourceMaps[generatedFilePath] = map;
            return map;
        }

        return null;
    }

    private parseInlineSourceMap(sourceMapContents: string, generatedFilePath: string) : SourceMap
    {
         if (sourceMapContents.indexOf("data:application/json;base64,") >= 0) {
            // sourcemap is inlined
            const pos = sourceMapContents.indexOf(',');
            const data = sourceMapContents.substr(pos+1);
            try {
                const buffer = new Buffer(data, 'base64');
                const json = buffer.toString();
                if (json) {
                    const map = new SourceMap(generatedFilePath, json, this._webRoot);
                    this._generatedToSourceMaps[generatedFilePath] = map;
                    return map;
                }
            }
            catch (e) {
                Logger.log(`can't parse inlince sourcemap. exception while processing data url (${e.stack})`);
            }
        }

        return null;
    }

	private _createSourceMap(mapPath: string, pathToGenerated: string): Promise<SourceMap> {
        let contentsP: Promise<string>;
        if (utils.isURL(mapPath)) {
            contentsP = utils.getURL(mapPath).catch(e => {
                Logger.log(`SourceMaps.createSourceMap: Could not download map from ${mapPath}`);
                return null;
            });
        } else {
            contentsP = new Promise((resolve, reject) => {
                FS.readFile(mapPath, (err, data) => {
                    if (err) {
                        Logger.log(`SourceMaps.createSourceMap: Could not read map from ${mapPath}`);
                        resolve(null);
                    } else {
                        resolve(data);
                    }
                });
            });
        }

        return contentsP.then(contents => {
            if (contents) {
                try {
                    // Throws for invalid contents JSON
                    return new SourceMap(pathToGenerated, contents, this._webRoot);
                } catch (e) {
                    Logger.log(`SourceMaps.createSourceMap: exception while processing sourcemap: ${e.stack}`);
                    return null;
                }
            } else {
                return null;
            }
        });
	}

    private _createSourceMapSync(mapPath: string, pathToGenerated: string): SourceMap {
        let contents = FS.readFileSync(mapPath, 'utf8');
        try {
            // Throws for invalid contents JSON
            return new SourceMap(pathToGenerated, contents, this._webRoot);
        } catch (e) {
            Logger.log(`SourceMaps.createSourceMap: exception while processing sourcemap: ${e.stack}`);
            return null;
        }
	}
}

enum Bias {
	GREATEST_LOWER_BOUND = 1,
	LEAST_UPPER_BOUND = 2
}

class SourceMap {
	private _generatedPath: string;		// the generated file for this sourcemap
	private _sources: string[];			// the sources of generated file (relative to sourceRoot)
	private _absSourceRoot: string;		// the common prefix for the source (can be a URL)
	private _smc: SourceMapConsumer;	// the source map
    private _webRoot: string;           // if the sourceRoot starts with /, it's resolved from this absolute path
    private _sourcesAreURLs: boolean;   // if sources are specified with file:///

    /**
     * pathToGenerated - an absolute local path or a URL
     * json - sourcemap contents
     * webRoot - an absolute path
     */
	public constructor(generatedPath: string, json: string, webRoot: string) {
        Logger.log(`SourceMap: creating SM for ${generatedPath}`)
		this._generatedPath = generatedPath;
        this._webRoot = webRoot;

		const sm = JSON.parse(json);
		this._absSourceRoot = PathUtils.getAbsSourceRoot(sm.sourceRoot, this._webRoot, this._generatedPath);

        // Overwrite the sourcemap's sourceRoot with the version that's resolved to an absolute path,
        // so the work above only has to be done once
        if (this._absSourceRoot.startsWith('/')) {
            // OSX paths
            sm.sourceRoot = 'file://' + this._absSourceRoot;
        } else {
            // Windows paths
            sm.sourceRoot = 'file:///' + this._absSourceRoot;
        }

        sm.sources = sm.sources.map((sourcePath: string) => {
            // special-case webpack:/// prefixed sources which is kind of meaningless
            sourcePath = utils.lstrip(sourcePath, 'webpack:///');

            // Force correct format for sanity
            return utils.fixDriveLetterAndSlashes(sourcePath);
        });

        this._smc = new SourceMapConsumer(sm);

        // rewrite sources as absolute paths
        this._sources = sm.sources.map((sourcePath: string) => {
            if (sourcePath.startsWith('file:///')) {
                // If one source is a URL, assume all are
                this._sourcesAreURLs = true;
            }

            sourcePath = utils.lstrip(sourcePath, 'webpack:///');
            sourcePath = PathUtils.canonicalizeUrl(sourcePath);
            if (Path.isAbsolute(sourcePath)) {
                return utils.fixDriveLetterAndSlashes(sourcePath);
            } else {
                return Path.join(this._absSourceRoot, sourcePath);
            }
        });
	}

    /*
     * Return all mapped sources as absolute paths
     */
    public get sources(): string[] {
        return this._sources;
    }

	/*
	 * the generated file of this source map.
	 */
	public generatedPath(): string {
		return this._generatedPath;
	}

	/*
	 * returns true if this source map originates from the given source.
	 */
	public doesOriginateFrom(absPath: string): boolean {
		return this.sources.some(path => path === absPath);
	}

	/*
	 * finds the nearest source location for the given location in the generated file.
	 */
	public originalPositionFor(line: number, column: number, bias: Bias = Bias.GREATEST_LOWER_BOUND): SourceMap.MappedPosition {

		const mp = this._smc.originalPositionFor(<any>{
			line: line,
			column: column,
			bias: bias
		});

		if (mp.source) {
			mp.source = PathUtils.canonicalizeUrl(mp.source);
		}

		return mp;
	}

	/*
	 * finds the nearest location in the generated file for the given source location.
	 */
	public generatedPositionFor(src: string, line: number, column: number, bias = Bias.GREATEST_LOWER_BOUND): SourceMap.Position {
        if (this._sourcesAreURLs) {
            src = 'file:///' + src;
        } else if (this._absSourceRoot) {
            // make input path relative to sourceRoot
			src = Path.relative(this._absSourceRoot, src);

            // source-maps use forward slashes unless the source is specified with file:///
            if (process.platform === 'win32') {
                src = src.replace(/\\/g, '/');
            }
		}

		const needle = {
			source: src,
			line: line,
			column: column,
			bias: bias
		};

		return this._smc.generatedPositionFor(needle);
	}
}
