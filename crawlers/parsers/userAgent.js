var request = require( 'request' )
  , async   = require( 'async' )
  , Iconv   = require( 'iconv' ).Iconv

// ** create
module.exports.create = function( host, identifier, maxRetries ) {
    // ** Set default maximum retries
    maxRetries = maxRetries ? maxRetries : 5

    // ** Initialize local variables
    var self            = { host: host, userAgent: identifier, maxRetries: maxRetries }
    var jar             = request.jar()
    var req             = request
    var gzip            = true
    var randomUserAgent = !identifier

    // ** Stats
    var bytesReceived = 0

    // ** setProxy
    self.setProxy = function( value ) {
        req = request.defaults( { proxy: value, timeout: 10000 } )
        jar = req.jar()
    }

    // ** setRandomUserAgent
    self.setRandomUserAgent = function() {
        self.userAgent = module.exports.random()
    }

    // ** getTotalReceived
    self.getTotalReceived = function() {
        return bytesReceived
    }

    // ** getJson
    self.getJson = function( target, callback ) {
        async.retry( self.maxRetries,
            function( callback, results ) {
                self.get( target,
                    function( err, result ) {
                        if( err ) return callback( err )

                        try {
                            result = JSON.parse( result )
                            if( !result ) return callback( new Error( 'failed to parse JSON response' ) )
                        } catch( e ) {
                            callback( e )
                        }

                        callback( null, result )
                    } )
            },
            function( err, result ) {
                if( callback ) callback( err, result )
            } )
    }

    // ** get
    self.get = function( target, callback ) {
        if( randomUserAgent ) self.setRandomUserAgent()

        async.retry( self.maxRetries,
            function( callback, results ) {
                req.get( { url: url( target ), jar: jar, followAllRedirects: true, headers: formatHeaders(), gzip: gzip, encoding: null },
                    function( err, res, body ) {
                        callback( err, decode( res ) )
                    } )
                    .on( 'response', calculateReceivedBytes )
                    .on( 'error', function( err ) {} )
                    .end()
            },
            function( err, result ) {
                if( callback ) callback( err, result )
            } )
    }

    // ** post
    self.post = function( target, params, callback ) {
        if( randomUserAgent ) self.setRandomUserAgent()

        async.retry( self.maxRetries,
            function( callback, results ) {
                req.post( { url: url( target ), jar: jar, followAllRedirects: true, headers: formatHeaders(), form: params, gzip: gzip, encoding: null },
                    function( err, res, body ) {
                        callback( err, decode( res ) )
                    } )
                    .on( 'response', calculateReceivedBytes )
                    .on( 'error', function( err ) {} )
                    .end()
            },
            function( err, result ) {
                if( callback ) callback( err, result )
            } )
    }

    // ** formatHeaders
    function formatHeaders() {
        var headers = { 'User-Agent': self.userAgent }

        if( gzip ) {
            headers['Accept-Encoding'] = 'gzip, deflate'
        }

        return headers
    }

    // ** calculateReceivedBytes
    function calculateReceivedBytes( response ) {
        response.on( 'data',
            function( data ) {
                bytesReceived += data.length
            } )
    }

    // ** decode
    function decode( res ) {
        if( !res ) return null

        var charset = 'utf-8'

        res.headers['content-type'].split( ';' ).forEach(
            function( item ) {
                var idx = item.indexOf( 'charset=' )
                if( idx != -1 ) {
                    charset = item.substr( idx + 'charset='.length )
                }
            } )

        try {
            return new Iconv( charset, 'utf-8' ).convert( res.body ).toString()
        }
        catch( e ) {
            console.log( 'Failed to decode response', e.message )
        }

        return res.body.toString()

    }

    // ** url
    function url( target ) {
        return target.indexOf( 'http://' ) == 0 || target.indexOf( 'https://' ) == 0 ? target : host + target
    }

    return self
}

// ** random
module.exports.random = function() {
    var list = require( 'fs' ).readFileSync( 'ua.txt' ).toString().split( '\n' )
    var idx  = Math.floor( Math.random() * (list.length - 1) )

    return list[idx]
}