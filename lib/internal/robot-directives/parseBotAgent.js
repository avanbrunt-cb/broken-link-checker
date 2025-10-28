"use strict";
var isbot = require("isbot").isbot;



/**
 * Parse a user agent string to determine if it's a bot and extract the bot name.
 * This replaces the useragent library with a simpler implementation using isbot.
 */
function parseBotAgent(userAgent)
{
	if (userAgent != null && userAgent.trim() !== "")
	{
		// Check if it's a bot using isbot
		if (isbot(userAgent))
		{
			// Extract bot name from user agent string
			// Common patterns: "BotName/version" or "BotName"
			const normalizedUA = userAgent.toLowerCase();
			
			// Try to extract the bot name before the first slash or space
			const match = normalizedUA.match(/^([a-z0-9\-_]+)(?:\/|\s|$)/i);
			if (match && match[1])
			{
				const botName = match[1].toLowerCase();
				// Return the bot name if it's not a generic term
				if (botName !== "mozilla" && botName !== "other")
				{
					return botName;
				}
			}
			
			// Try to find known bot names within the user agent string
			const knownBots = [
				"googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider",
				"yandexbot", "sogou", "exabot", "facebot", "ia_archiver",
				"twitterbot", "linkedinbot", "applebot", "facebookexternalhit"
			];
			
			for (const botName of knownBots)
			{
				if (normalizedUA.includes(botName))
				{
					return botName;
				}
			}
		}
	}
	
	return "robots";
}



module.exports = parseBotAgent;

