var async   = require( 'async' )
  , request = require( 'request' )

// ** create
module.exports.create = function() {
    var self = { list: [], current: null, used: [] }

    // ** loadFromFox
    self.loadFromFox = function( callback ) {
        loadFoxProxies(
            function( err, result ) {
                if( err ) return callback( err )
                filterProxies( result, 10000,
                    function( err, result ) {
                        if( err ) return callback( err )
                        self.list = result
                        callback( null, result )
                    } )
            } )
    }

    // ** count
    self.count = function() {
        return self.list.length
    }

    // ** first
    self.first = function() {
        self.current = self.list
        return self.current.shift()
    }

    // ** next
    self.next = function() {
        return self.current.shift()
    }

    // ** numFreeProxies
    self.numFreeProxies = function() {
        var free = self.list.filter( function( item ) { return self.used.indexOf( item.host ) == -1 } )
        return free.length
    }

    // ** random
    self.random = function() {
        var proxy   = null
        var counter = 1000

        do {
            var randomIdx = Math.floor( Math.random() * self.list.length )
            proxy         = self.list[randomIdx]

            if( self.isInUse( proxy ) ) {
                proxy = null
            }

            counter--
        } while( proxy == null && counter > 0 )

        return proxy
    }

    // ** retain
    self.retain = function( proxy ) {
        if( self.isInUse( proxy ) ) {
            throw new Error( 'Proxy ' + proxy.host + ' is already in use' )
        }

        self.used.push( proxy.host )

        return proxy
    }

    // ** release
    self.release = function( proxy ) {
        var idx = self.used.indexOf( proxy.host )
        if( idx != -1 ) {
            self.used.splice( idx, 1 )
        }
    }

    // ** isInUse
    self.isInUse = function( proxy ) {
        return self.used.indexOf( proxy.host ) != -1
    }

    // ** saveToJson
    self.saveToJson = function( pretty ) {
        return JSON.stringify( self.list, null, pretty ? 4 : 0 )
    }

    // ** saveToFile
    self.saveToFile = function( fileName ) {
        require( 'fs' ).writeFileSync( fileName, self.saveToJson( true ) )
        console.log( self.list.length, 'proxies are saved to file' )
    }

    // ** loadFromJson
    self.loadFromJson = function( value ) {
        try {
            self.list = []
            self.list = JSON.parse( value )
        }
        catch( e ) {
            console.log( 'Failed to load proxies from JSON' )
        }
    }

    // ** loadFromFile
    self.loadFromFile = function( fileName ) {
        self.loadFromJson( require('fs').readFileSync( fileName, 'utf8' ) )
        console.log( self.list.length, 'proxies are loaded from file' )
    }

    // ** sortBySpeed
    function sortBySpeed( a, b ) {
        if( a.time < b.time ) return -1
        if( a.time > b.time ) return  1

        return 0
    }

    // ** loadFoxProxies
    function loadFoxProxies( callback ) {
        var proxies = []

        {(function loader(page) {
            request.post( { url: 'http://api.foxtools.ru/proxy/json', form: { ID: 323, KEY: 'd1317640-b3be-4099-9ee7-bbbf9b388997', AVAILABLE: 1, FREE: 1, PAGE: page, PROTOCOL: 2 } },
                function( err, res, body ) {
                    if( err ) return callback( err )

                    try {
                        var result = JSON.parse( body ).list
                        proxies = proxies.concat( result )

                        if( result.length == 0 ) {
                            return callback( null, proxies )
                        }
                    } catch( e ) {
                        return callback( new Error( 'failed to parse response' ) )
                    }

                    loader( page + 1 )
                } )
        }(0))}
    }

    // ** filterProxies
    function filterProxies( list, timeout, callback ) {
        async.filter( list,
            function( item, callback ) {
                var proxy = 'http://' + item.ip + ':' + item.port

                item.time = process.hrtime()

                request.defaults( { proxy: proxy, timeout: timeout } ).get( 'https://play.google.com',
                    function( err, res, body ) {
                        item.time = process.hrtime( item.time )[1] / 1000000

                        if( err ) return callback( false )
                        callback( body.indexOf( 'Google Play' ) != -1 )
                    } )
            },
            function( results ) {
                results.sort( sortBySpeed )
                loadProxyLocations( results, callback )
            } )
    }

    // ** loadProxyLocations
    function loadProxyLocations( list, callback ) {
        async.map( list,
            function( item, callback ) {
                callback( null, { host: 'http://' + item.ip + ':' + item.port } )
            /*
                request.get( 'https://freegeoip.net/json/' + item.ip,
                    function( err, res, body ) {
                        var location = null

                        try {
                            location = JSON.parse( body )
                        } catch( e ) {
                            console.log( 'Warning: failed to resolve a location for', item.ip )
                        }

                        callback( err, { host: 'http://' + item.ip + ':' + item.port, location: location } )
                    } )
            */
            },
            callback )
    }

    return self
}