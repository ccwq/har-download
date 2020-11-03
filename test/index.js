'use strict';
const har = require("../");
const fs = require("fs");
const path = require("path");


const harPath = path.join(__dirname, "demo.HAR");
const distPath = path.join(__dirname, "dist");

har.fromText(
	fs.readFileSync(harPath, 'utf-8'),
	distPath,
	function(err) {
    console.log(err);
		har.formFile(path.join(__dirname, "demo.har"), path.join(__dirname, "dist1"), function(err) {
			console.log(err);
		});
	}
);
