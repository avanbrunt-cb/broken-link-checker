"use strict";
var guard = require("robots-txt-guard");
var parse = require("robots-txt-parse");

const axios = require("axios");

function getRobotsTxt(url, options) {
	url = new URL(url);

	url.hash = null;
	url.pathname = "/robots.txt";
	url.search = null;

	return axios.get(url.href, {
		headers: { "user-agent": options.userAgent },
		responseType: 'stream'
	})
	.then(response => parse(response.data))
	.then(guard);
}



module.exports = getRobotsTxt;
