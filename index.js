var Promise = require( 'es6-promise' ).Promise,
	quickTemp = require( 'quick-temp' ),
	Ractive = require( 'ractive' ),
	rcu = require( 'rcu' ),
	fs = require( 'fs' ),
	path = require( 'path' ),
	tosource = require( 'tosource' ),
	CleanCSS = require( 'clean-css' ),

	fileExtension = /\.[a-zA-Z]+$/,

	promisify,
	glob,
	mkdirp,
	readFile,
	writeFile;

rcu.init( Ractive );

var RactiveCompiler, templates = {}, builders = {};

promisify = (function ( slice ) {
	return function ( fn, context ) {
		return function () {
			var args = slice.call( arguments );

			return new Promise( function ( fulfil, reject ) {
				var callback = function ( err ) {
					if ( err ) return reject( err );
					fulfil.apply( null, slice.call( arguments, 1 ) );
				};

				args.push( callback );
				fn.apply( context, args );
			});
		};
	};
}( [].slice ));

glob = promisify( require( 'glob' ) );
mkdirp = promisify( require( 'mkdirp' ) );
readFile = promisify( fs.readFile, fs );
writeFile = promisify( fs.writeFile, fs );

RactiveCompiler = function ( inputTree, options ) {
	var key;

	if ( !( this instanceof RactiveCompiler ) ) {
		return new RactiveCompiler( inputTree, options );
	}

	this.inputTree = inputTree;

	for ( key in options ) {
		if ( options.hasOwnProperty( key ) ) {
			this[ key ] = options[ key ];
		}
	}

	if ( !this.destDir ) {
		throw new Error( 'broccoli-ractive: You must specify a destination directory' );
	}
};

RactiveCompiler.prototype = {
	constructor: RactiveCompiler,

	read: function (readTree) {
		var self = this;

		quickTemp.makeOrRemake( this, 'ractiveCompiler' );

		return this.write( readTree, this.ractiveCompiler ).then( function () {
			return self.ractiveCompiler;
		});
	},

	cleanup: function () {
		quickTemp.remove(this, 'ractive-compiler')
	},

	write: function ( readTree, destDir ) {
		var self = this;

		return readTree( self.inputTree ).then( function ( srcDir ) {

			// glob all input file patterns, and create components from them
			var promises = self.files.map( resolvePattern ).map( function ( pattern ) {
				return glob( pattern ).then( createComponents );
			});

			return Promise.all( promises );

			function resolvePattern ( pattern ) {
				return path.join( srcDir, pattern );
			}

			function createComponents ( matches ) {
				var promises = matches.map( function ( componentPath ) {
					var relativePath, outputPath, outputFolder;

					relativePath = path.relative( srcDir, componentPath );

					outputPath = path.join( destDir, self.destDir, relativePath.replace( fileExtension, '.js' ) );
					outputFolder = path.join( outputPath, '..' );

					return createComponent( componentPath ).then( writeComponent );

					function writeComponent ( built ) {
						return mkdirp( outputFolder ).then( function () {
							return writeFile( outputPath, built );
						});
					}
				});

				return Promise.all( promises );
			}
		});

		function createComponent ( componentPath ) {
			return readFile( componentPath ).then( function ( result ) {
				var source, parsed, built;

				source = result.toString();
				parsed = rcu.parse( source );
				built = builders.amd( parsed );

				return built;
			});
		}
	}
};

builders.amd = function ( definition, imported ) {
	var builtModule = '' +
		'define([' +
			definition.imports.map( getImportPath ).concat( '"require"', '"ractive"' ).join( ',\n' ) +
		'], function(' +
			definition.imports.map( getImportName ).concat( 'require', 'Ractive' ).join( ',\n' ) +
		'){\n' +
		'var __options__ = {\n' +
		'	template: ' + tosource( definition.template ) + ',\n' +
		( definition.css ?
		'	css:' + JSON.stringify( new CleanCSS().minify( definition.css ) ) + ',\n' : '' ) +
		( definition.imports.length ?
		'	components:{' + definition.imports.map( getImportKeyValuePair ).join( ',\n' ) + '}\n' : '' ) +
		'},\n' +
		'component={},\n' +
		'__prop__;';

	if ( definition.script ) {
		builtModule += '\n' + definition.script + '\n' +
			'  if ( typeof component.exports === "object" ) {\n    ' +
				'for ( __prop__ in component.exports ) {\n      ' +
					'if ( component.exports.hasOwnProperty(__prop__) ) {\n        ' +
						'__options__[__prop__] = component.exports[__prop__];\n      ' +
					'}\n    ' +
				'}\n  ' +
			'}\n\n  ';
	}

	builtModule += 'return Ractive.extend(__options__);\n});';
	return builtModule;


	function getImportPath ( imported ) {
		return '\t"' + imported.href.replace( fileExtension, '' ) + '"';
	}

	function getImportName ( imported, i ) {
		return '\t__import' + i + '__';
	}

	function getImportKeyValuePair ( imported, i ) {
		return '\t' + stringify( imported.name ) + ': __import' + i + '__';
	}

	function stringify ( key ) {
		if ( /^[a-zA-Z$_][a-zA-Z$_0-9]*$/.test( key ) ) {
			return key;
		}

		return JSON.stringify( key );
	}
};


module.exports = RactiveCompiler;
