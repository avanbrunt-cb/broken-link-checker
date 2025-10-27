"use strict";

function matchUrl(url, keywords) {
  if (url == null) {
    return false;
  }

  for (let keyword of keywords) {
    if (keyword.includes("*")) {
      // Wildcard match
      const pattern = keyword.replace(/([.+?^=!:${}()|[\]\/\\])/g, "\\$1").replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`); // Anchored regex
      if (regex.test(url)) {
        return true;
      }
    } else {
      // Simple containment
      if (url.includes(keyword)) {
        return true;
      }
    }
  }

  return false;
}

module.exports = matchUrl;