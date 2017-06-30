import {transform} from 'babel-core';
import assert from 'assert';
import {Script, createContext} from 'vm';
import asyncToBluebird from '../main.es2015.js';

const VM_CONTEXT = new createContext({require});

function run(code) {
	const result = transform(code, {
		code: true,
		ast: false,
		sourceMaps: false,
		babelrc: false,
		plugins: [
			'transform-flow-strip-types',
			asyncToBluebird,
			'transform-es2015-modules-commonjs'
		],
	});
	return new Script(result.code, {}).runInContext(VM_CONTEXT);
}

function runEq(desiredRes, code) {
	return run(code).then(res => assert.equal(desiredRes, res));
}

it('resolve non promises', () => {
	return runEq(1337, `
		(async () => {
			return await 1337;
		})();
	`);
});

it('async methods', () => {
	return runEq([
		'begin',
		'wa_begin',
		'wa_resolve',
		'wa_end',
		'woa',
		'end',
	], `
		class Test {
			async with_await() {
				let ret = ['wa_begin'];
				ret.push(await 'wa_resolve');
				ret.push('wa_end');
				return ret;
			}

			async without_await() {
				return ['woa'];
			}
		}
		(async () => {
			let ret = ['begin'];
			ret.push(...(await new Test().with_await()));
			ret.push(...(await new Test().without_await()));
			ret.push('end');
			return ret;
		})();
	`);
});
