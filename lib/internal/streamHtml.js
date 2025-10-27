"use strict";
var errors         = require("./messages").errors;
var simpleResponse = require("./simpleResponse");

const axios = require("axios");

function checkErrors(response)
{
	let error,type;

	if (response.statusCode !== 200)
	{
		error = new Error(errors.HTML_RETRIEVAL);
		error.code = response.statusCode;
		return error;
	}

	type = response.headers["content-type"];

	if (type === "null") {
		type = undefined;
	}

	// content-type is not mandatory in HTTP spec
	if (type==null || type.indexOf("text/html")!==0)
	{
		error = new Error(errors.EXPECTED_HTML(type));
		return error;
	}
}



/*
	Request a URL for its HTML contents and return a stream.
*/
function streamHtml(url, cache, options)
{
	const headers = { "user-agent": options.userAgent };
	if (options.authorization) {
		headers.authorization = options.authorization;
	}

	const request = axios.get(url, {
		headers: headers,
		responseType: 'stream'
	})
	.catch(error => {
		if (error.response) {
			// Not a network error, probably a 4xx or 5xx
			return error.response;
		}
		// A network error
		if (options.cacheResponses === true) cache.set(url, error);
		throw error;
	})
	.then(orgResponse => {
		const response = simpleResponse(orgResponse);

		if (options.cacheResponses === true) {
			cache.set(response.url, response);
		}

		const error = checkErrors(response);

		if (error) {
			throw error;
		}

		const result = {
			response: response,
			stream: orgResponse.data
		};

		if (options.cacheResponses === true && response.url !== url) {
			cache.set(response.url, response);
		}

		return result;
	});

	if (options.cacheResponses === true) {
		cache.set(url, request);
	}

	return request;
}



module.exports = streamHtml;
