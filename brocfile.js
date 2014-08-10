var pick = require( 'broccoli-static-compiler' ),
	merge = require( 'broccoli-merge-trees' ),
	compileRactive = require( './index' );

var staticFiles = pick( 'example', {
	srcDir: '/',
	files: [ 'index.html', 'require.js', 'ractive.js' ],
	destDir: '/'
});

var components = compileRactive( 'example/components', {
	destDir: 'components'
});

module.exports = merge([ staticFiles, components ]);
