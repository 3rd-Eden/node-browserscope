var express	= require( "express" )
,		sys			= require( "sys" )

// Create our webserver
var app = express.createServer();

// Configure the middleware that we wish to use for this application
app.configure(function(){
	// Note! you should only enable gzip if you node-compress installed
	// or you will be spawning gzip processes like madman: http://gist.github.com/557691
	app.use( express.gzip() );
	app.use( express.logger() );
	app.use( require( "../lib" )() )

	// We want to use a router
	app.use( app.router );
	app.use( express.errorHandler({ dumpExceptions: true, showStack: true }) );
});

// Handle the different routes
app.get( "/", function( req, res, next ){
	console.log("o");
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.write( "<h1>req.browser</h1><code><pre>" + sys.inspect( req.browser ) + "</pre></code>" );
	res.write( "<h1>req.os</h1><code><pre>" + sys.inspect( req.os ) + "</pre></code>" );
	res.write( "<h1>req.capabilities</h1><code><pre>" + sys.inspect( req.capabilities ) + "</pre></code>" );
	res.end();
});

app.listen( 8080 );
console.log( "Listening to port 8080 on localhost" );