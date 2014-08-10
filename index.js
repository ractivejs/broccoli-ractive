var Promise = require( 'es6-promise' ).Promise,
	Writer = require( 'broccoli-writer' ),
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

module.exports = RactiveCompiler;

rcu.init( Ractive );

var templates = {}, builders = {};

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

function RactiveCompiler ( inputTree, options ) {
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

	if ( !this.files ) {
		// default to compiling all HTML files in the input tree
		this.files = [ '**/*.html' ];
	}

	if ( !this.destDir ) {
		throw new Error( 'broccoli-ractive: You must specify a destination directory' );
	}

	this.type = this.type || 'amd';

	if ( !builders[ this.type ] ) {
		throw new Error( 'Supported options for the "type" option are ' + Object.keys( builders ).join( ', ' ) );
	}
}

RactiveCompiler.prototype = Object.create( Writer.prototype );
RactiveCompiler.prototype.constructor = RactiveCompiler;

RactiveCompiler.prototype.write = function ( readTree, destDir ) {
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
			var source, parsed, builder, built;

			source = result.toString();
			parsed = rcu.parse( source );

			builder = builders[ self.type ];
			built = builder( parsed );

			return built;
		});
	}
};

createBody = function ( definition ) {
	var body = '' +
		'var __options__ = {\n' +
		'	template: ' + tosource( definition.template, null, '' ) + ',\n' +
		( definition.css ?
		'	css:' + JSON.stringify( new CleanCSS().minify( definition.css ) ) + ',\n' : '' ) +
		( definition.imports.length ?
		'	components:{' + definition.imports.map( getImportKeyValuePair ).join( ',\n' ) + '}\n' : '' ) +
		'},\n' +
		'component={},\n' +
		'__prop__,\n' +
		'__export__;';

	if ( definition.script ) {
		body += '\n' + definition.script + '\n' +
			'  if ( typeof component.exports === "object" ) {\n    ' +
				'for ( __prop__ in component.exports ) {\n      ' +
					'if ( component.exports.hasOwnProperty(__prop__) ) {\n        ' +
						'__options__[__prop__] = component.exports[__prop__];\n      ' +
					'}\n    ' +
				'}\n  ' +
			'}\n\n  ';
	}

	body += '__export__ = Ractive.extend( __options__ );\n';
	return body;

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

builders.amd = function ( definition ) {
	var dependencies, builtModule;

	dependencies = definition.imports.map( getImportPath ).concat( definition.modules );

	builtModule = '' +
		'define([\n\t' +
			dependencies.map( quote ).concat( '"require"', '"ractive"' ).join( ',\n\t' ) + '\n' +
		'], function(\n\t' +
			dependencies.map( getDependencyName ).concat( 'require', 'Ractive' ).join( ',\n\t' ) + '\n' +
		'){\n' +

		createBody( definition ) +
		'return __export__;\n' +
		'});';

	return builtModule;

	function getImportPath ( imported ) {
		return imported.href.replace( fileExtension, '' );
	}

	function quote ( str ) {
		return '"' + str + '"';
	}

	function getDependencyName ( imported, i ) {
		return '__import' + i + '__';
	}
};

builders.cjs = function ( definition ) {
	var requireStatements, builtModule;

	requireStatements = definition.imports.map( function ( imported, i ) {
		return '__import' + i + '__ = require(\'' + imported.href.replace( fileExtension, '' ) + '\')';
	});

	requireStatements.unshift( 'Ractive = require(\'ractive\')' );

	builtModule = 'var ' + requireStatements.join( ',\n\t' ) + ';\n\n' +
	createBody( definition ) +
	'module.exports = __export__;';

	return builtModule;
};

builders.es6 = function ( definition ) {
	var importStatements, builtModule;

	importStatements = definition.imports.map( function ( imported, i ) {
		return 'import __import' + i + '__ from \'' + imported.href.replace( fileExtension, '' ) + '\';';
	});

	importStatements.unshift( 'import Ractive from \'ractive\';' );

	builtModule = importStatements.join( '\n\t' ) + ';\n\n' +
	createBody( definition ) +
	'export default __export__;';

	return builtModule;
};


module.exports = RactiveCompiler;
