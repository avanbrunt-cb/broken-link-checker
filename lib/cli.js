"use strict";
var blc            = require("./");
var defaultOptions = require("./internal/defaultOptions");
var pkg            = require("../package.json");

var chalk = require("chalk");
var humanizeDuration = require("humanize-duration");
var optionator = require("optionator");

process.on("unhandledRejection", function(reason, p) {
	console.error("Unhandled Rejection", reason);
	process.exit(1);
});

function cli() {
	const filterLevel = `The types of tags and attributes that are considered links.\n\n	  0: clickable links\n
	  1: 0 + media, iframes, meta refreshes\n
	  2: 1 + stylesheets, scripts, forms\n
	  3: 2 + metadata\n
	  Default: ${defaultOptions.filterLevel}`;

	this.optionator = optionator({
		title: "Broken Link Checker",
		description: pkg.description,
		version: pkg.version,
		name: "blc",
		concatRepeatedArrays: true,
		options: [
		{
			option: "authorization",
			alias: "a",
			type: "String",
			description: "Optional authorization header value to include with each request."
		},
		{
			option: "exclude",
			rename: "excludedKeywords",
			type: "[String]",
			description: "A keyword/glob to match links against. Can be used multiple times."
		},
			{
				option: "exclude-external",
				alias: "e",
				type: "Boolean",
				rename: "excludeExternalLinks",
				description: "Will not check external links."
			},
			{
				option: "exclude-internal",
				alias: "i",
				type: "Boolean",
				rename: "excludeInternalLinks",
				description: "Will not check internal links."
			},
		{
			option: "filter-level",
			type: "Number",
			default: String(defaultOptions.filterLevel),
			description: filterLevel
		},
			{
				option: "follow",
				alias: "f",
				type: "Boolean",
				rename: "followRobotExclusions",
				description: "Force-follow robot exclusions."
			},
			{
				option: "get",
				alias: "g",
				type: "Boolean",
				description: "Change request method to GET."
			},
			{
				option: "help",
				alias: ["h", "?"],
				type: "Boolean",
				description: "Display this help text."
			},
		{
			option: "input",
			type: "String",
			description: "URL to an HTML document."
		},
		{
			option: "host-requests",
			type: "Number",
			default: String(defaultOptions.maxSocketsPerHost),
			rename: "maxSocketsPerHost",
			description: "Concurrent requests limit per host."
		},
			{
				option: "ordered",
				alias: "o",
				type: "Boolean",
				rename: "maintainLinkOrder",
				description: "Maintain the order of links as they appear in their HTML document."
			},
			{
				option: "recursive",
				alias: "r",
				type: "Boolean",
				description: "Recursively scan (\"crawl\") the HTML document(s)."
			},
		{
			option: "requests",
			type: "Number",
			default: String(defaultOptions.maxSockets),
			rename: "maxSockets",
			description: "Concurrent requests limit."
		},
		{
			option: "user-agent",
			type: "String",
			default: JSON.stringify(defaultOptions.userAgent),
			description: "The user agent to use for link checks."
		},
			{
				option: "verbose",
				alias: "v",
				type: "Boolean",
				description: "Display excluded links."
			},
			{
				option: "version",
				alias: "V",
				type: "Boolean",
				description: "Display the app version."
			}
		]
	});
}



cli.prototype.input = function(args, showArgs)
{
	args = args || process.argv;
	const options = this.optionator.parse(args);

	if (options.help === true)
	{
		log( this.optionator.generateHelp() );
	}
	else if (options.version === true)
	{
		log(pkg.version);
	}
	else if (options.input != null)
	{
		var checkerOpts = {
			authorization:				  options.authorization,
			excludedKeywords:       options.exclude || defaultOptions.excludedKeywords,
			excludeExternalLinks:   options.excludeExternalLinks===true,
			excludeInternalLinks:   options.excludeInternalLinks===true,
			excludeLinksToSamePage: options.verbose!==true,
			filterLevel:            options.filterLevel,
			honorRobotExclusions:   options.followRobotExclusions!==true,
			maxSockets:             options.maxSockets,
			maxSocketsPerHost:      options.maxSocketsPerHost,
			requestMethod:          options.get===true ? "get" : "head",
			userAgent:              options.userAgent
		};
		
		run(options.input, checkerOpts,
		{
			excludeCachedLinks:   options.verbose!==true,
			excludeFilteredLinks: options.verbose!==true,
			maintainLinkOrder:    options.maintainLinkOrder===true,
			recursive:            options.recursive===true
		});
	}
	else
	{
		console.error("Input URL required. Use --help for more options.");
		process.exit(1);
	}
};



function log()
{
	// Just log directly - spinner handling was causing issues
	console.log.apply(null, arguments);
}



function run(url, checkerOptions, logOptions)
{
	var instance;
	var pageCount = 0;
	var totalLinks = 0;
	var brokenLinks = 0;
	var cachedLinks = 0;
	var excludedLinks = 0;
	var brokenList = {};
	var startTime = Date.now();

	var handlers = {
		html: function(tree, robots, response, pageUrl)
		{
			pageCount++;
			var output = "";
			if (pageCount > 1) output += "\n";
			output += chalk.white("Getting links from: ") + chalk.yellow(pageUrl);
			log(output);
		},
		
		junk: function(result)
		{
			// Filtered links - only show if verbose
			if (logOptions.excludeFilteredLinks !== true)
			{
				excludedLinks++;
				totalLinks++;
				var output = chalk.gray("├─") + chalk.gray("─SKIP── ") + chalk.yellow(result.url.original || result.url.resolved);
				if (result.excludedReason)
				{
					output += chalk.gray(" (" + result.excludedReason + ")");
				}
				log(output);
			}
			else
			{
				excludedLinks++;
				totalLinks++;
			}
		},
		
		link: function(result)
		{
			totalLinks++;
			
			// Determine if we should show this link
			var shouldShow = true;
			
			if (result.broken)
			{
				brokenLinks++;
				brokenList[result.url.resolved] = true;
			}
			else if (result.http.cached && logOptions.excludeCachedLinks === true)
			{
				cachedLinks++;
				shouldShow = false;
			}
			else if (result.http.cached)
			{
				cachedLinks++;
			}
			
			if (shouldShow)
			{
				var output = chalk.gray("├─");
				
				if (result.broken === true)
				{
					output += chalk.red("BROKEN");
					output += chalk.gray("─ ");
					output += chalk.yellow(result.url.resolved);
					output += chalk.gray(" (" + result.brokenReason + ")");
				}
				else if (result.excluded === true)
				{
					output += chalk.gray("─SKIP── ");
					output += chalk.yellow(result.url.resolved);
					output += chalk.gray(" (" + result.excludedReason + ")");
				}
				else
				{
					output += chalk.gray("──");
					output += chalk.green("OK");
					output += chalk.gray("─── ");
					output += chalk.yellow(result.url.resolved);
					
					if (result.http.cached === true)
					{
						output += chalk.gray(" (CACHED)");
					}
				}
				
				log(output);
			}
		},
		
		page: function(error, pageUrl)
		{
			if (error != null)
			{
				log(chalk[error.code !== 200 ? "red" : "gray"](error.name + ": " + error.message));
			}
		},
		
		site: function(error, siteUrl)
		{
			// For SiteChecker, this is called after each site is complete
			if (error != null)
			{
				log(chalk.red("Site error: " + error.message));
			}
		},
		
		end: function()
		{
			var duration = Date.now() - startTime;
			var output = "\n";
			
			output += chalk.gray("Finished! " + totalLinks + " links found.");
			
			if (cachedLinks > 0)
			{
				output += chalk.gray(" " + cachedLinks + " cached.");
			}
			
			if (excludedLinks > 0)
			{
				output += chalk.gray(" " + excludedLinks + " excluded.");
			}
			
			if (totalLinks > 0)
			{
				output += chalk.gray(" ");
				output += chalk[brokenLinks > 0 ? "red" : "green"](brokenLinks + " broken");
				output += chalk.gray(".");
			}
			
			if (logOptions.recursive && pageCount > 1)
			{
				output += chalk.gray("\n" + pageCount + " pages crawled.");
			}
			
			if (brokenLinks > 0)
			{
				for (var link in brokenList)
				{
					output += chalk.red("\n" + link);
				}
			}
			
			output += chalk.gray("\nElapsed time: ");
			output += chalk.gray(humanizeDuration(duration, {round: true, largest: 2}));
			
			log(output);
			
			process.exit(brokenLinks > 0 ? 1 : 0);
		}
	};

	if (logOptions.recursive !== true)
	{
		instance = new blc.HtmlUrlChecker(checkerOptions, handlers);
	}
	else
	{
		instance = new blc.SiteChecker(checkerOptions, handlers);
	}

	instance.enqueue(url);
}



module.exports = cli;
