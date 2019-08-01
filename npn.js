#!/usr/bin/env node
"use_strict";

const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('https');
const { spawn, spawnSync } = require('child_process');
let total_installed = 0; // global

function help(exit) {
	console.log(
`NPN: The simple package manager for node
Usage:
	npn install [name/url]
	npn uninstall name
	npn update [name]

NPN works best when packages reference urls like this:
{ "npn": "gitlab:thann/npn#v0.0.1" }`);
	if (exit !== undefined) process.exit(exit);
}

module.exports = {
	async install(name, version, dir='.') {
		console.debug("Installing:", name, version)
		ensureDir(dir);
		try {
			let [_name , _version, repo] = [name , version, null];
			if (!version) {
				[_name, _version, repo] = parseVersion(name);
			}
			const [rel, ver] = /^([\^~=>]*)(.*)$/.exec(version).splice(1,3);
			console.debug("    ====>", _name, rel, ver, repo)
			dir += '/node_modules/' + _name;
			if (!repo) { // Attempt to scry the git url from the NPM registry
				const infoUrl = `https://registry.npmjs.org/${name}/`;
				const def = JSON.parse(await fetch(infoUrl))
				// if (def.repository.type === 'git') {
				// 	//TODO:
				// 	repo = def.repository.url
				// }
				// console.log("AAAAAARRRR", def.repository.url)
			}
			if (repo) {
				if (fs.existsSync(dir)) {
					// TODO: cd!
					const p = spawnSync('git', ['pull', 'origin', version]);
					console.log("GIT pull:", p.output.toString())
				} else {
					const clone = spawnSync('git', ['clone',
						...(version? ['--branch', version]: []),
						'--single-branch', '--', repo, dir]);
					console.log("GIT:", clone.output.toString())
				}

				// TODO: gpg
				// spawnSync('git', ['verify-commit', 'HEAD'])
			} else  {
				await tarballInstall(name, ver, dir);
			}

			if (fs.existsSync(dir + '/package.json'))
				await installDependencies(dir);
			total_installed += 1;
		} catch(e) {
			console.error("ERROR Failed to install:", name, version);
			console.debug(e);
			process.exit(1);
		}
	},
	async clean() {
		throw "not implemented"
	},
	async update(name) {
		throw "not implemented"
	},
	async uninstall() {
		throw "not implemented"
	},
};

// synchronous http.get
async function fetch(url, options, callback) {
	let done;
	const p = new Promise((d) => { done = d; });
	if (!callback) {
		callback = options;
		options = {};
	}
	const req = http.get(url, options, (resp) => {
		if (callback)
			callback(req, resp, done);
		else {
			// collect and return data
			let data = '';
			resp.on('data', (d) => {
				data += d;
			});
			resp.on('end', () => {
				done(data);
			});
		}
	});
	req.on('error', (e) => {
		console.debug(e);
		throw new Error(`Failed to fetch: ${url}`);
	})
	// await p
	return p;
}

function ensureDir(dir) {
	try {
		fs.mkdirSync(dir, { recursive: true });
	} catch(e) {}
}

// Download packages from NPM 🤮
async function tarballInstall(name, version, dir) {
	ensureDir(dir);
	const untar = spawn('tar', ['xzC', dir, '--strip-components=1']);
	const url = `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`;
	return fetch(url, async function(request, response, done) {
		if (response.statusCode === 200) {
			response.pipe(untar.stdio[0]);
			untar.on('close', done);
		} else {
			console.debug(`ERROR: failed to download [${response.statusCode}]: ${url}`);
			process.exit(4);
		}
	});
}

// extrace version from name
function parseVersion(name) { // name, version, url
	let protcol, domain, path, ver;
	try { // full url
		[protocol, domain , path, ver] = (
			/(https?|ssh):\/\/([^\/]+)\/([^#]+)#?(.*)/
			).exec(name).slice(2, 5);
	} catch(e) {
		try { // short url
			protocol = 'https';
			[domain, path, v] = (
				/([^:]+):([^#]+)#?(.*)/).exec(name).slice(1, 4);
			if (domain.indexOf('.') < 0) {
				domain += '.com';
			}
		} catch(e) {
			console.debug(e);
			throw new Error(`invalid version/url: ${name}`);
		}
	}
	const url = `${protocol}://${domain}/${path}${ver?`#${ver}`:''}`;
	return [path.split('/')[1] || name, ver, url];
}

function findUpdate() {

}

function preInstall(pjson) {
	// TODO: implement!
}

function postInstall(pjson) {
	// TODO: implement!
}

async function installDependencies(dir='.', dev) {
	const pjson = require(dir + '/package.json');
	preInstall(pjson, dir);
	for (const [name, version] of Object.entries(Object.assign({},
			pjson.dependencies,
			dev? pjson.devDependencies: {}))) {
		await module.exports.install(name, version, dir);
	}
	postInstall(pjson, dir);
}

if (require.main = module) {
	(async () => {
		// TODO: Parse args
		switch (process.argv[2]) {
		case 'i':
		case 'install':
			if (process.argv[3]) {
				await module.exports.install(process.argv[3]);
			} else {
				try {
					await installDependencies(undefined, true);
				} catch(e) {
					console.error(e);
					help(2);
				}
			}
			console.log(`Installed: ${total_installed} packages.`);
			break;
		case 'clean':
			await module.exports.clean();
			break;
		case 'update':
			await module.exports.update(process.argv[3]);
			break;
		case 'rm':
		case 'uninstall':
			await module.exports.uninstall(process.argv[3]);
			break;
		case 'help':
		case undefined:
			help(0);
			break;
		default:
			console.error(`Error: "${process.argv[2]}" is not a command!`)
			help(3);
		}
	})();
}
