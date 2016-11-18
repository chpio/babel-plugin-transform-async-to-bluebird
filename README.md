# babel-plugin-transform-async-to-bluebird

This plugin transforms `async` to `bluebird`.

## Examples

An *async* function containing **no** *await* gets wrapped by *bluebird*s
[*method*](http://bluebirdjs.com/docs/api/promise.method.html) function without
using the generator, resulting in less overhead. All returned or thrown values
are wrapped by *Promis*es and then returned.
```javascript
async function myFunction(input) {
	if (input === 0) throw new TypeError('Invalid input');
	if (input === 42) return promiseReturningFunction(input);
	return input + 10;
}

myFunction(0); // Returns a Promise, rejecting into an TypeError('Invalid input')
myFunction(42); // Returns a Promise
myFunction($other_value); // Returns a Promise, resolving into $other_value + 10
```

On the other side an *async* + *await* function gets wrapped by *bluebird*s
[*coroutine*](http://bluebirdjs.com/docs/api/promise.coroutine.html); it's
using the generator.

```javascript
async function myFunction(input) {
	if (input === 0) throw new TypeError('Invalid input');
	const res = await promiseReturningFunction(input);
	return res + 10;
}
```

## Usage

1. Install *bluebird*: `npm install --save bluebird`
2. Install the plugin: `npm install --save-dev babel-plugin-transform-async-to-bluebird`
3. Add *transform-async-to-bluebird* to your *.babelrc* file:
```json
{
	"plugins": ["transform-async-to-bluebird"]
}
```

## Credits
This babel plugin is based on
[babel-helper-remap-async-to-generator](https://github.com/babel/babel/tree/master/packages/babel-helper-remap-async-to-generator)
