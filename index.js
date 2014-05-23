var Writer = require( 'broccoli-writer' ),
	Promise = require( 'es6-promise' ).Promise,
	Ractive = require( 'ractive' ),
	rcu = require( 'rcu' ),
	fs = require( 'fs' ),
	path = require( 'path' ),
	mkdirp = require( 'mkdirp' ),
	tosource = require( 'tosource' ),
	glob = require( 'glob' );

rcu.init( Ractive );

var RactiveCompiler = function ( inputTree, options ) {
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

RactiveCompiler.prototype = Object.create( Writer.prototype );
RactiveCompiler.prototype.constructor = RactiveCompiler;

RactiveCompiler.prototype.write = function ( readTree, destDir ) {
	var self = this;

	return new Promise( function ( fulfil, reject ) {
		readTree( self.inputTree ).then( function ( srcDir ) {
			Promise.all( self.files.map( function ( pattern ) {
				return new Promise( function ( fulfil, reject ) {
					glob( path.join( srcDir, pattern ), function ( err, result ) {
						if ( err ) throw err;

						return Promise.all( result.map( createComponent ) );
					});
				});
			}) ).then( fulfil );
		});
	});

	function createComponent ( componentPath ) {
		return new Promise( function ( fulfil, reject ) {
			fs.readFile( componentPath, function ( err, result ) {
				var source, parsed;

				if ( err ) throw err;

				source = result.toString();
				parsed = rcu.parse( source );

				console.log( 'parsed', parsed );

				Promise.all( parsed.imports.map( function ( toImport ) {
					var importPath = rcu.resolve( toImport.href, componentPath );
					return {
						name: toImport.name,
						definition: createComponent( importPath )
					};
				}) ).then( function ( imported ) {

					// TODO!

				});

				fulfil();
			});
		});
	}
};

module.exports = RactiveCompiler;
