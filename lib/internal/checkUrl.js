"use strict";
var extend         = require("extend");
var isString       = require("is-string");
var linkObj        = require("./linkObj");
var reasons        = require("./messages").reasons;
var simpleResponse = require("./simpleResponse");

const axios = require("axios");

function checkUrl(link, baseUrl, cache, options, retry)
{
	if (retry === undefined)
	{
		if (isString(link) === true)
		{
			link = linkObj(link);
			linkObj.resolve(link, baseUrl, options);
		}

		if (link.url.resolved === null)
		{
			link.broken = true;
			link.brokenReason = "BLC_INVALID";
			linkObj.clean(link);
			return Promise.resolve(link);
		}

		const cached = cache.get(link.url.resolved);

		if (cached !== undefined)
		{
			return Promise.resolve(cached).then(cachedData =>
			{
				// If cachedData has a preserved response object, reuse it
				if (cachedData.preservedResponse) {
					link.http.response = cachedData.preservedResponse;
				} else {
					copyResponseData(cachedData, link, options);
				}

				link.http.cached = true;

				return link;
			});
		}
	}

	const headers = { "user-agent": options.userAgent };

	if (options.authorization) {
		headers.authorization = options.authorization;
	}

	const request = axios.request({
		url: link.url.resolved,
		method: retry !== 405 ? options.requestMethod : "get",
		headers: headers,
		timeout: 5000,
		maxRedirects: 10
	})
	.then(response => {
		const simple = simpleResponse(response);
		simple.raw = response;
		return simple;
	})
	.catch(error => {
		if (error.response) {
			if (error.response.status === 405 && options.requestMethod === "head" && options.retry405Head === true && retry !== 405) {
				return checkUrl(link, baseUrl, cache, options, 405);
			}
			const simple = simpleResponse(error.response);
			simple.raw = error.response;
			return simple;
		}
		return error;
	});

	if (retry === undefined)
	{
		if (options.cacheResponses === true)
		{
			cache.set(link.url.resolved, request);
		}

		return request.then(response =>
		{
			copyResponseData(response, link, options);

			link.http.cached = false;

			// After creating link.http.response, preserve it in the cached data
			if (options.cacheResponses === true)
			{
				// Attach the response object to the cached data for future reuse
				response.preservedResponse = link.http.response;
				
				// If there was a redirect, cache the redirected URL too
				if (link.url.redirected !== null)
				{
					try {
						const redirectedUrl = new URL(link.url.redirected);
						cache.set(redirectedUrl.href, Promise.resolve(response));
					} catch (e) {
						// Ignore invalid redirected URLs
					}
				}
			}

			return link;
		});
	}
	else
	{
		return request;
	}
}



/*
	Copy data from a response object—either from a request or cache—
	into a link object.
*/
function copyResponseData(response, link, options)
{
	if (response instanceof Error === false)
	{
		if (response.statusCode !== 200)
		{
			link.broken = true;
			link.brokenReason = "HTTP_" + response.statusCode;
		}
		else
		{
			link.broken = false;
		}

		// Build redirects array - follow-redirects doesn't populate _redirects array in newer versions
		// Use _redirectCount to create a synthetic array of the right length
		const redirectCount = response.raw.request._redirectable?._redirectCount || 0;
		const redirects = [];
		for (let i = 0; i < redirectCount; i++) {
			redirects.push({}); // Empty object placeholder for each redirect
		}
		
		link.http.response = {
			headers: response.raw.headers,
			statusCode: response.raw.status,
			statusMessage: response.raw.statusText,
			url: response.raw.request.res.responseUrl,
			redirects: redirects
		};

		if (link.url.resolved.split('#')[0] !== response.url.split('#')[0])
		{
			link.url.redirected = response.url;

			if (link.base.resolved !== null)
			{
				// TODO :: this needs a test
				linkObj.relation(link, link.url.redirected);
			}
		}
	}
	else
	{
		link.broken = true;

		// Handle axios 1.x specific error codes
		if (response.code === "ERR_INVALID_URL")
		{
			// Axios 1.x throws ERR_INVALID_URL before making request
			// Treat same as connection refused for compatibility
			link.brokenReason = "ERRNO_ECONNREFUSED";
		}
		else if (reasons["ERRNO_"+response.code] != null)
		{
			link.brokenReason = "ERRNO_" + response.code;
		}
		/*else if (response.message === "Invalid URL")
		{
			link.brokenReason = "BLC_INVALID";
		}*/
		else
		{
			link.brokenReason = "BLC_UNKNOWN";
		}
	}

	linkObj.clean(link);
}



module.exports = checkUrl;