// @flow
import syntaxAsyncFunctions from 'babel-plugin-syntax-async-functions';
import type {NodePath} from 'babel-traverse';
import traverse from 'babel-traverse';
import nameFunction from 'babel-helper-function-name';
import template from 'babel-template';

const FUNCTION_TYPES = [
	'FunctionDeclaration',
	'FunctionExpression',
	'ArrowFunctionExpression',
];

const BUILD_WRAPPER = template(`
	(() => {
		var REF = FUNCTION;
		return function NAME(PARAMS) {
			return REF.apply(this, arguments);
		};
	})
`);

const NAMED_BUILD_WRAPPER = template(`
	(() => {
		var REF = FUNCTION;
		function NAME(PARAMS) {
			return REF.apply(this, arguments);
		}
		return NAME;
	})
`);

export default function asyncToBluebird(pluginArg: any) {
	const {types: t} = pluginArg;

	function classOrObjectMethod(path: NodePath, state: any, hasAwait: boolean) {
		const {node} = path;
		const {body} = node;

		node.async = false;
		node.generator = hasAwait; // selbst hinzugefügt (richtig so?)

		const container = t.functionExpression(null, [], t.blockStatement(body.body), true);
		container.shadow = true;
		const bbImport = state.addImport('bluebird', hasAwait ? 'coroutine' : 'method');
		body.body = [
			t.returnStatement(
				t.callExpression(
					t.callExpression(
						bbImport,
						[container]
					),
					[]
				)
			),
		];
	}

	function plainFunction(path: NodePath, state: any, hasAwait: boolean) {
		const {node} = path;
		const isDeclaration = path.isFunctionDeclaration();
		const asyncFnId = node.id;

		let wrapper = BUILD_WRAPPER;
		if (path.isArrowFunctionExpression()) path.arrowFunctionToShadowed();
		else if (!isDeclaration && asyncFnId) wrapper = NAMED_BUILD_WRAPPER;

		node.async = false;
		node.generator = hasAwait;

		node.id = null;

		if (isDeclaration) node.type = 'FunctionExpression';

		const bbImport = state.addImport('bluebird', hasAwait ? 'coroutine' : 'method');
		const built = t.callExpression(bbImport, [node]);
		const container = wrapper({
			NAME: asyncFnId,
			REF: path.scope.generateUidIdentifier('ref'),
			FUNCTION: built,
			PARAMS: node.params.map(() => path.scope.generateUidIdentifier('x')),
		}).expression;

		if (isDeclaration) {
			const declar = t.variableDeclaration('let', [
				t.variableDeclarator(
					t.identifier(asyncFnId.name),
					t.callExpression(container, [])
				),
			]);
			declar._blockHoist = true;

			path.replaceWith(declar);
		} else {
			const retFunction = container.body.body[1].argument;
			if (!asyncFnId) {
				nameFunction({
					node: retFunction,
					parent: path.parent,
					scope: path.scope,
				});
			}

			if (!retFunction || retFunction.id || node.params.length) {
				// we have an inferred function id or params so we need this wrapper
				path.replaceWith(t.callExpression(container, []));
			} else {
				// we can omit this wrapper as the conditions it protects for do not apply
				path.replaceWith(built);
			}
		}
	}

	return {
		inherits: syntaxAsyncFunctions,
		visitor: {
			Function(path: NodePath, state: any) {
				const {node, scope} = path;
				if (!node.async || node.generator) return;
				const hasAwait = traverse.hasType(node.body, scope, 'AwaitExpression', FUNCTION_TYPES);

				traverse(node, {
					blacklist: FUNCTION_TYPES,

					AwaitExpression(path2: NodePath) {
						// eslint-disable-next-line no-param-reassign
						path2.node.type = 'YieldExpression';
					},
				}, scope);

				const isClassOrObjectMethod = path.isClassMethod() || path.isObjectMethod();
				(isClassOrObjectMethod ? classOrObjectMethod : plainFunction)(path, state, hasAwait);
			},
		},
	};
}
