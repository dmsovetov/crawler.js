var userAgent   = require( './userAgent' )
  , cheerio     = require( 'cheerio' )
  , url         = require( 'url' )

// ** Parser
module.exports.Parser = function( callback ) {
    var self  = { token: 'e5359ea2dc62a471b279185e0e3f482c' }
    var host  = userAgent.create( 'https://kinokontakt.ru' )

    // ** findVideo
    self.findVideo = function( name, callback ) {
        requestFilmId( name,
            function( err, filmId ) {
                if( err ) return callback( err )

                host.get( '/film/' + filmId + '?s=e5359ea2dc62a471b279185e0e3f482c',
                    function( err, result ) {
                        if( err ) return callback( err )

                        var $   = cheerio.load( result )
                        var src = $('#video-content .viboom-overroll iframe' ).attr( 'src' )

                        if( !src ) return callback( 'No video found' )

                        var v           = url.parse( src, true )
                        var videoUrl    = 'http://vk.com/video' + v.query.oid + '_' + v.query.id

                    //    checkVideoURL( videoUrl )

                        callback( null, 'http://vk.com/video' + v.query.oid + '_' + v.query.id )
                    } )
            } )
    }

    // ** checkVideoURL
    function checkVideoURL( url, callback ) {
        host.get( url,
            function( err, result ) {
                if( err ) return callback( err )

                var $ = cheerio.load( result )
                var n = $('#mv_title')

                console.log( 'x', n.text(), result )
            } )
    }

    // ** requestFilmId
    function requestFilmId( name, callback ) {
        host.getJson( '/search/?s=' + self.token + '&q=' + name + '&action=autocomplete&sort=autocomplete',
            function( err, result ) {
                if( err ) return callback( err )
                if( result.length == 0 ) return callback( 'Nothing found' )

                var filmId = lookupFilmId( name, result )

                if( !filmId ) return callback( 'Ambiguous film identifier' )

                callback( null, filmId )
            } )
    }

    // ** lookupFilmId
    function lookupFilmId( name, items ) {
        for( var i = 0; i < items.length; i++ ) {
            if( !items[i].value ) {
                continue
            }

            var n = items[i].value.split( '/' )

            if( n[0].trim() == name || n[1].trim() == name ) {
                return items[i].id
            }
        }

        return null
    }

    callback( null, self )

    return self
}