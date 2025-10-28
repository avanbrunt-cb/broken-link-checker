"use strict";



/*
	Remove a prefixed "no" from a string.
*/
function removeNo(directive)
{
	return directive.substr(2);
}



module.exports = removeNo;

