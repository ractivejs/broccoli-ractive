# broccoli-ractive

This [broccoli](https://github.com/broccolijs/broccoli) plugin compiles Ractive component files. If you're not yet familiar with component files, [start here](https://github.com/ractivejs/component-spec).

To try it out:

```bash
# Clone this repo and set it up
git clone https://github.com/ractivejs/broccoli-ractive.git
cd broccoli-ractive
npm i

# Fire up broccoli
broccoli serve
```

Once you're up and running, navigate to [localhost:4200](http://localhost:4200). You should see a clock - the one defined in the [clock.html](https://github.com/ractivejs/broccoli-ractive/blob/master/example/components/clock.html) component file.

For the demo, we're converting to an AMD module, but you can also generate node.js modules (e.g. for use with the [broccoli-browserify](https://github.com/gingerhendrix/broccoli-browserify) plugin) or ES6 modules.



## Installation

```bash
npm i -D broccoli-ractive    # `i` is short for `install`, `-D` means `--save-dev`
```


## Usage

Inside your `brocfile.js`:

```js
var compileRactive = require( 'broccoli-ractive' );

var tree = compileRactive( inputTree, {
	destDir: 'path/to/output'
});
```

The `inputTree` option can be a string, e.g. `path/to/ractive_components`. The second argument is an object with the following options:

* **destDir** - self-explanatory!
* files - optional, defaults to `[**/*.html]` (i.e. all HTML files in the input tree). An array of file [minimatch patterns](https://github.com/isaacs/minimatch) to match.
* type - optional, defaults to `amd`. The type of JavaScript module to convert to. Can be either `amd`, `cjs` (node.js modules) or `es6`.


## License

MIT.
