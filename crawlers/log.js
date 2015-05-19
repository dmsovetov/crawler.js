var format = require( 'util' ).format
  , colors = require( 'colors' )

// ** create
module.exports.create = function( color ) {
    var self = {}

    // ** print
    self.print = function() {
        console.log( self.format( arguments ) )
    }

    // ** format
    self.format = function( args ) {
        var argv    = Array.prototype.slice.call( args, 0 )
        var message = argv.join( ' ' )

        return color ? message[color] : message
    }

    return self
}