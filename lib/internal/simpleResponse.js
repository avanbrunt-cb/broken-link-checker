"use strict";
const urlobj = require("urlobj");

// TODO :: change to `response.url` and `response.status`
function simpleResponse(response)
{
	const simplified = {
		headers: response.headers,
		url: response.request.res.responseUrl,
		statusCode: response.status,
		statusMessage: response.statusText
	};

	if (response.headers && response.headers["content-type"]) {
		simplified.contentType = response.headers["content-type"].split(";")[0];
	} else {
		simplified.contentType = undefined;
	}

	return simplify(response, simplified);
}



function simplify(response, simplified)
{
	if (response instanceof Error)
	{
		simplified.error = response;
	}
	else
	{
		// simplified.url = urlobj.parse(simplified.url);
	}
	
	return simplified;
}



module.exports = simpleResponse;
