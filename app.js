var express     = require( 'express' )
  , async       = require( 'async' )
  , proxy       = require( './crawlers/proxy' )
  , credential  = require( './crawlers/credentials' )
  , playmarket  = require( './crawlers/playmarket' )
  , kinopoisk   = require( './crawlers/kinopoisk' )

  , video       = require( './crawlers/parsers/video' ).Parser
  , monk        = require( 'monk' )

var app = express()

// ** Launch
module.exports.launch = function( port ) {
    var server = app.listen( port,
        function() {
            var host = server.address().address
            var port = server.address().port
            console.log( 'Example app listening at http://%s:%s', host, port )
/*
            video(
                function( err, parser ) {
                    var db    = monk( 'localhost/movielens' )
                    var items = db.get( 'items' )

                    items.find( { video: { $eq: null } },
                        function( err, result ) {
                            // ** Process each item
                            async.eachLimit( result, 50,
                                function( item, cb ) {
                                    if( !item.name.ru ) return cb()

                                    // ** Find video URL
                                    parser.findVideo( item.name.ru,
                                        function( err, result ) {
                                            if( err ) console.log( item.name.ru && item.name.ru.red )
                                            else {
                                                items.updateById( item._id, { $set: { video: result } } )
                                                console.log( item.name.ru )
                                            }

                                            cb()
                                        } )
                                },
                                function( err ) {
                                    console.log( 'All done' )
                                } )
                        } )
                } )
*/
            kinopoisk.create( { concurrency: 1, delay: 0 } )
/*
            // ** Load proxies
            var proxies = proxy.create()

            console.log( 'Loading proxies...' )
            proxies.loadFromFox(
                function( err, result ) {
                    if( err ) return console.log( 'Failed to load proxies from Fox', err.message )

                    console.log( proxies.count(), 'proxies available' )

                    kinopoisk.create( { concurrency: 64, delay: 0 }, proxies )

                    // ** Start a continuous proxy list update
                    async.forever(
                        function( next ) {
                            console.log( 'Updating proxies list...' )
                            proxies.loadFromFox( function() { next() } )
                        } )
                } )*/
        } )
}
