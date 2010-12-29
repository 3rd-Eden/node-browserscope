// Require all middleware dependencies, we need to use a http module to
// retreive the stored results from the browserscope API. If users have a stored
// JSON version, we need to read it out using our fs module. And to parse down the
// user agent string in a browserscope compatible format we need to use my useragent
// module. 
var req  = require( "request" )
,		fs	 = require( "fs" )
,		ua	 = require( "useragent" );


// Some helper functions, merge will allow us to merge to objects together.
// as simple as that. The first argument is the object where the other object
// need to be merged in.
var merge = function( target, obj ){
		for( var i in obj )
			target[i] = obj[i];
		
		return target;
	},

/// We are going to remodel the datastructure to a object instead of a array.
// this allows us to do key lookups instead of searching. The transform function
// receives the JSON structure of browserscope and re-formats it
	transform = function( JSON ){
		var data = JSON.results
		,		i = data.length
		,		resultset = {}
		,		ua
		,		tmp
		,		key;
		
		
		while( i-- ){
			// parse down the values
			ua = Object.keys( data[i] );
			tmp = data[i][ua].results;
			
			key = resultset[ ua ] = {
				score: +( data[i][ua].score || 0 )
			}
			
			// transform the data to a correct, and workable value
			data[i][ua].results.forEach(function( result ){
				var testname = Object.keys( result )
				,		obj = result[ testname ]
				, 	props
				, 	j;
				
				if( obj.display && obj.display !== "" ){
					// check if we need to parse down the value or not, because the JSKB has a comma seperated value in the display
					// like: "contains, getElsByClass"
					if( obj.display === "yes" || obj.display === "no" ){
						key[ testname ] = obj.display === "yes";
					
					// Maybe it's a numeric value like max connections.. 
					} else if( +obj.display ){
						key[ testname ] = +obj.display;
					
					// Last resort, it must have been a comma seperated value
					} else if( ~ obj.display.indexOf( ", " ) ) {
						props = obj.display.split( ", " );
						j = props.length;
						while( j-- ){
							key[ props[j] ] = true;
						}
					
					// oh, than it's just a single value.. 
					} else {
						key[ obj.display ] = true;
					}
					
				} else {
					key[ testname ] = +obj.score;
				}
			});
		}
		
		return resultset;
	};


// The actual middleware layer starts here:
module.exports = function( options ){
	// Our default options, this will allow us to check if we need to fetch the data
	// from the servers or not, and what kind of accuracy users want. The more accurate
	// the bigger the file we will need to fetch and store in memory.
	var defaults = {
				// The locations of the local JSON databases
				security: false
			, network: false
			, kb: false
				
				// the accuracy level
			, accuracy: "all"
			};
			
	// Our private defaults, these contain the locations of the API's and the correct version
	// mapping for our accuracy.
	var privates = {
		// The url's of the API locations, if we need to fetch the data using a HTTP connection
		api: {
					security: "http://www.browserscope.org/?category=security&v=%accuracy%&o=json"
				,	network: "http://www.browserscope.org/?category=network&v=%accuracy%&o=json"
				,	kb: "http://www.browserscope.org/?category=jskb&v=%accuracy%&o=json"
			},
		
		// accuracy mapping	
		accuracy: {
			major: 1
		, minor: 2
		, all: 3
		},
		
		// the actual data object
		database: {
			security: false
			, network: false
			, kb: false
		}
	};
	
	// Merge the options object with our defaults, so we can start setting up our data ref.
	if( options ) merge( defaults, options );
	
	// Start gathering the data
	[ "security", "network", "kb" ].forEach(function( key ){
		// Check if we need to do a HTTP request, or read out a file using the fs module
		if( defaults[ key ] === false ){
			req({
					// fetch the url from our privates API, and replace the accuracy with the correct v number
					uri: privates.api[ key ].replace( "%accuracy%", privates.accuracy[ defaults.accuracy ] ) 
				},
				
				// Process the data, and store it in the correct database location
				function( error, response, body ) {
					if( !error && response.statusCode === 200 ){
						privates.database[ key ] = transform( JSON.parse( body ) );
						console.log( "Processed browserscope database: " + key );
					}
				}
			);
		} else {
		
		}
	});
	
	// Now that we have initialized our code, we are going to return our actual middleware
	// layer. This should parse out all the data correctly, and map useragent results back
	// to  clients.
	return function( req, res, next ){
		var useragent = req.headers[ "user-agent" ]
		,		parser = ua.parser( useragent )
		,		browser = ua.browser( useragent )
		,		key = parser.pretty();
		
		// create a browser object, with all the details that we have gathered
		req.browser = {
			is: browser
		,	family: parser.family
		, name: key
		};
		
		// create a operating system object with all the details that we have parsed
		req.os = {
			family: parser.os.family
		,	name: parser.prettyOs()
		};
		
		// check for browser capabilities
		req.capabilities = {
			security: privates.database.security ? privates.database.security[ key ] || false : false 
		,	network: privates.database.network ? privates.database.network[ key ] || false : false
		,	kb: privates.database.kb ? privates.database.kb[ key ] || false : false
		}
		
		// Now that we have done our thing, let other do there thing with the requests :)
		next();
	}
}