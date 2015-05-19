
// ** create
module.exports.create = function() {
    var self = { list: [], current: null, used: [] }

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

    // ** numFree
    self.numFree = function() {
        var free = self.list.filter( function( item ) { return self.used.indexOf( item.login ) == -1 } )
        return free.length
    }

    // ** random
    self.random = function() {
        var item    = null
        var counter = 10000

        do {
            var randomIdx = Math.floor( Math.random() * self.list.length )
            item          = self.list[randomIdx]

            if( self.isInUse( item ) ) {
                item = null
            }

            counter--
        } while( item == null && counter > 0 )

        return item
    }

    // ** retain
    self.retain = function( item ) {
        if( self.isInUse( item ) ) {
            throw new Error( 'Credential ' + item.login + ' is already in use' )
        }

        self.used.push( item.login )

        return item
    }

    // ** release
    self.release = function( item ) {
        var idx = self.used.indexOf( item.login )
        if( idx != -1 ) {
            self.used.splice( idx, 1 )
        }
    }

    // ** isInUse
    self.isInUse = function( item ) {
        return self.used.indexOf( item.login ) != -1
    }

    // ** saveToJson
    self.saveToJson = function( pretty ) {
        return JSON.stringify( self.list, null, pretty ? 4 : 0 )
    }

    // ** saveToFile
    self.saveToFile = function( fileName ) {
        require( 'fs' ).writeFileSync( fileName, self.saveToJson( true ) )
        console.log( self.list.length, 'credentials are saved to file' )
    }

    // ** loadFromJson
    self.loadFromJson = function( value ) {
        try {
            self.list = []
            self.list = JSON.parse( value )
        }
        catch( e ) {
            console.log( 'Failed to load credentials from JSON' )
        }
    }

    // ** loadFromFile
    self.loadFromFile = function( fileName ) {
        self.loadFromJson( require('fs').readFileSync( fileName, 'utf8' ) )
        console.log( self.list.length, 'credentials are loaded from file' )
    }

    return self
}