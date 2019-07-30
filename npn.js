#!/usr/bin/env node
"use_strict";

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

function help(exit) {
	console.log(
`NPN: The simple package manager for node
Usage:
	npn install [name/url]
	npn uninstall name
	npn update [name]

NPN works best when packages reference urls like this:
{ "npn": "gitlab:thann/npn#v0.0.1" }`);
	if (exit) process.exit(exit);
}

module.exports = {
	install(name, version, dir='.') {
		console.debug("Installing:", name, version)
		const [_name, vesion, repo] = parseVersion(version);
		dir += '/node_modules/' + (name || _name);
		if (repo) {
			const clone = spawnSync('git', ['clone',
				'--branch', vesion, '--single-branch', '--', repo, dir]);

			console.log("GIT:", clone.output.toString())

			// const p = spawnSync('git', ['pull', 'origin', vesion]);

			// TODO: gpg
			// spawn('git', ['verify-commit', 'HEAD'])
		} else  {
			fallbackInstall(name, version, dir);
		}

		installDependencies(dir);
		total_installed += 1;
	},
	clean() {
		throw "not implemented"
	},
	update(name) {
		throw "not implemented"
	},
	uninstall() {
		throw "not implemented"
	},
};

// Esure basic things exist
function init() {
	try {
		fs.mkdirSync('./node_modules/');
	} catch(e) {}
}

// Download packages from NPM 🤮
function fallbackInstall(name, version, dir) {
	throw "not implemented"
	const r = Math.floor((Math.random() * 9999) + 1000);
	const fname = path.join(os.tmpdir(), `npn-${r}.tgz`);
	const file = fs.createWriteStream(fname);
	const url = `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`;
	const request = http.get(url, function(response) {
	  response.pipe(file);
	});
	const untar = spawnSync('tar', ['xzf', fname, dir]);
	console.log("TAR:", untar)
}

function parseVersion(version) {
	//TODO: implement parseVersion!
	return ['pingg', '0.0.1', 'https://gitlab.com/thann/pingg']
}

function installDependencies(dir='./', dev) {
	const pjson = require(dir + '/package.json');
	for (const [name, version] of Object.entries(Object.assign({},
			pjson.dependencies,
			dev? pjson.devDependencies: {}))) {
		module.exports.install(name, version, dir);
	}
}

let total_installed = 0
if (require.main = module) {
	// TODO: Parse args
	switch (process.argv[2]) {
	case 'i':
	case 'install':
		if (process.argv[3]) {
			init();
			const  [name, version, url] = parseVersion(process.argv[3])
			module.exports.install(name, version);
		} else {
			try {
				init();
				iterDeps('./', true);
				console.log(`Installed: ${total_installed} packages`);
			} catch(e) {
				console.error(e)
				help(1);
			}
		}
		break;
	case 'clean':
		module.exports.clean();
		break;
	case 'update':
		module.exports.update(process.argv[3]);
		break;
	case 'rm':
	case 'uninstall':
		module.exports.uninstall(process.argv[3]);
		break;
	case undefined:
		help(2);
		break;
	default:
		console.error(`Error: "${process.argv[2]}" is not a command!`)
		help(3);
	}
}