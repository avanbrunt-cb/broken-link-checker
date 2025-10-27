"use strict";
var isString = require("is-string");
var urllib = require("url");
var hasOwnProperty = Object.prototype.hasOwnProperty;

function toParsed(url) {
	return {
		protocol: url.protocol,
		hostname: url.hostname,
		port: url.port,
		pathname: url.pathname,
		search: url.search,
		hash: url.hash,
	};
}


function linkObj(url)
{
	if (url===undefined || isString(url)===false)
	{
		url = null;
	}

	var link =
	{
		url:
		{
			original: url,      // The URL as it was inputted
			resolved: null,     // The URL, resolved as a browser would do so
			redirected: null    // The URL, after its last redirection, if any
		},

		base:
		{
			original: null,     // The base URL as it was inputted
			resolved: null,     // The base URL, resolved as a browser would do so
			hostname: null      // The base URL hostname
		},

		html:
		{
			index: null,        // The order in which the link appeared in its document -- using max-level tag filter
			offsetIndex: null,  // Sequential (gap-free) indicies for skipped and unskipped links
			location:null,      // Source code location of the attribute that the link was found within
			selector: null,     // CSS selector for element in document
			tagName: null,      // Tag name that the link was found on
			attrName: null,     // Attribute name that the link was found within
			attrs: null,        // All attributes on the element
			text: null,         // TextNode/innerText within the element
			tag: null,          // The entire tag string

			// Temporary keys
			base: null
		},

		http:
		{
			cached: null,       // If the response was pulled from cache
			response: null      // The request response
		},

		broken: null,           // If the link was determined to be broken or not
		internal: null,         // If the link is to the same server as its base/document
		samePage: null,         // If the link is to the same page as its base/document
		excluded: null,         // If the link was excluded due to any filtering

		brokenReason: null,     // The reason why the link was considered broken, if it indeed is
		excludedReason: null,   // The reason why the link was excluded from being checked, if it indeed was

		// Temporary keys
		broken_link_checker: true,
		resolved: false
	};

	// Not enumerable -- hidden from `JSON.stringify()`
	Object.defineProperty(link.base, "parsed", { value:null, writable:true });  // Same as `link.base.resolved`, but is an Object
	Object.defineProperty(link.url,  "parsed", { value:null, writable:true });  // Same as `link.url.resolved`, but is an Object

	return link;
}



/*
	Remove unnecessary keys for public use.
*/
linkObj.clean = function(link)
{
	delete link.broken_link_checker;
	delete link.html.base;  // TODO :: don't clean this?
	delete link.resolved;

	return link;
};



/*
	Define relationships with base URL.
*/
linkObj.relation = function(link, url_parsed)
{
	if (url_parsed === undefined) url_parsed = link.url.parsed;
	else if (typeof url_parsed === "string") {
        url_parsed = toParsed(new URL(url_parsed));
    }

	// If no protocols, it's impossible to determine if they link to the same server
	if (link.base.isRelative === true || url_parsed.protocol === null || link.base.parsed.protocol === null)
	{
		// Overwrite any previous values
		link.internal = null;
		link.samePage = null;
	}
	else
	{
		const sameHostname = url_parsed.hostname === link.base.parsed.hostname;
		const samePort = url_parsed.port === link.base.parsed.port;
		const sameProtocol = url_parsed.protocol === link.base.parsed.protocol;

		link.internal = sameProtocol && sameHostname && samePort;
		link.samePage = link.internal && url_parsed.pathname === link.base.parsed.pathname && url_parsed.search === link.base.parsed.search;
	}

	return link;
};



/*
	Absolute'ize a link based on its base URL and HTML's <base>.
*/
// TODO :: make similar to `url.resolve(from,to)` ?
linkObj.resolve = function(link, base, options)
{
	// If already resolved
	if (link.resolved === true) return;

	let base_parsed_url;
	link.base.isRelative = false;
	try {
		base_parsed_url = new URL(base);
	} catch (e) {
		base_parsed_url = new URL(base || '', 'http://localhost/');
		link.base.isRelative = true;
	}
	const htmlBase_parsed_url = link.html.base ? new URL(link.html.base, base_parsed_url.href) : base_parsed_url;

	// Hashes are useless in a base
	htmlBase_parsed_url.hash = "";

	const resolvedBase_parsed_url = htmlBase_parsed_url;

	let linkOrg_parsed_url;
	let urlParseError = false;
	try {
		linkOrg_parsed_url = new URL(link.url.original || '', resolvedBase_parsed_url);
	} catch (e) {
		// Invalid URL - create a minimal URL object with what we have
		urlParseError = true;
		// Try to parse as absolute URL to extract protocol at least
		try {
			// For URLs like "http://" we want to preserve them as "http:///"
			const protocol = link.url.original.match(/^([a-z][a-z0-9+.-]*:)/i)?.[1] || 'http:';
			linkOrg_parsed_url = new URL(protocol + '///');
		} catch (e2) {
			linkOrg_parsed_url = resolvedBase_parsed_url;
		}
	}

	const resolvedUrl_parsed_url = linkOrg_parsed_url;

	if (base !== undefined)
	{
		link.base.original = base;
	}

    if (link.base.isRelative && resolvedBase_parsed_url.hostname === 'localhost') {
        let resolved;
        if (link.html.base) {
            if (base && base.startsWith('#')) {
                resolved = link.html.base;
            } else if (link.html.base.startsWith('/')) {
                resolved = link.html.base;
            } else if (link.html.base.startsWith('?')) {
                let baseWithoutQuery = base ? base.split('?')[0] : '';
                resolved = baseWithoutQuery + link.html.base;
            } else if (link.html.base.startsWith('#')) {
                let baseWithoutHash = base ? base.split('#')[0] : '';
                resolved = baseWithoutHash + link.html.base;
            } else {
                let basePath = base ? base.substring(0, base.lastIndexOf('/') + 1) : '';
                resolved = basePath + (link.html.base || '');
            }
        } else {
            resolved = base;
        }
        let finalResolved = resolved ? parity(resolved.split('#')[0]) : null;
        if (finalResolved === '') {
            finalResolved = null;
        }
        link.base.resolved = finalResolved;
    } else if (resolvedBase_parsed_url.href !== "http://localhost/") {
		link.base.resolved = parity(resolvedBase_parsed_url.href.split('#')[0]);
		link.base.hostname = resolvedBase_parsed_url.hostname;
	}


	link.base.parsed = toParsed(base_parsed_url);

	// If resolved link has accepted scheme
	let resolveLink = true;
	if (link.base.isRelative) {
	    if (resolvedBase_parsed_url.hostname === 'localhost') {
	        resolveLink = false;
	    }
	}

	let isAbsolute = false;
	try {
		new URL(link.url.original);
		isAbsolute = true;
	} catch (e) {
		// Check if it looks like an absolute URL (has protocol)
		if (link.url.original && /^[a-z][a-z0-9+.-]*:/i.test(link.url.original)) {
			isAbsolute = true;
		}
	}
if ((isAbsolute || resolveLink) && options.acceptedSchemes[ resolvedUrl_parsed_url.protocol.replace(/:$/, '') ] === true)
	{
		// Handle special case where URL parsing failed but we have an absolute URL
		if (urlParseError && isAbsolute) {
			link.url.resolved = parity(link.url.original);
			link.url.parsed = toParsed(resolvedUrl_parsed_url);
		} else {
			link.url.resolved = parity(resolvedUrl_parsed_url.href);
			link.url.parsed   = toParsed(resolvedUrl_parsed_url);
		}

		linkObj.relation(link);
	}
	// Else could not be properly resolved
	else
	{
		link.url.parsed = toParsed(linkOrg_parsed_url);
		if (link.base.isRelative === false && options.acceptedSchemes[link.base.parsed.protocol.replace(/:$/, '')] === true) {
			link.internal = false;
			link.samePage = false;
		}
	}

	// Avoid future resolving
	link.resolved = true;

	return link;
};



//::: PRIVATE FUNCTIONS



/*
	Clones an object and its prototype while maintaining enumerable
	keys and support for `instanceof`.
*/
// TODO :: this may not be necessary if linkObj.base.parsed and linkObj.url.parsed are cleaned out
// TODO :: move this into urlobj
function cloneObject(source)
{
	var clone,key,value;

	if (Array.isArray(source) === true)
	{
		clone = [];
	}
	else
	{
		// Only clone the prototype -- more efficient as it will not convert keys to prototype keys
		clone = Object.create( Object.getPrototypeOf(source) );
	}

	// Clone keys/indexes
	// TODO :: use Object.keys() for more speed
	for (key in source)
	{
		if (hasOwnProperty.call(source, key) === true)
		{
			value = source[key];

			if (value!==null && typeof value==="object")
			{
				clone[key] = cloneObject(value);
			}
			else
			{
				clone[key] = value;
			}
		}
	}

	return clone;
}



/*
	Maintain parity with core `url.resolve()`.
*/
// TODO :: remove this?
function parity(url)
{
	return (url !== "http://") ? url : "http:///";
}



module.exports = linkObj;