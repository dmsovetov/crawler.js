var userAgent   = require( './userAgent' )
  , xml2js      = require( 'xml2js' )

module.exports.Parser = function( callback ) {
    var self = {}
    var ua   = userAgent.create( null, null, null, 'windows-1251' )

    // ** parseRSS
    self.parseRSS = function( url, callback ) {
        ua.get( url,
            function( err, result ) {
                if( err ) return callback( err )

                xml2js.parseString( result,
                    function( err, result ) {
                        var version     = result.rss.$.version
                        var channel     = result.rss.channel[0]
                        var title       = channel.title[0]
                        var copyright   = channel.copyright ? channel.copyright[0] : null
                        var description = channel.description[0]
                        var date        = new Date( Date.parse( channel.lastBuildDate[0] ) )
                        var image       = channel.image[0]
                        var items       = []

                        channel.item.forEach(
                            function( item ) {
                                items.push( { title: item.title[0], link: item.link[0], description: item.description[0], guid: item.guid[0], date: new Date( Date.parse( item.pubDate[0] ) ), author: item.author ? item.author[0] : null } )
                            } )

                        callback( null,
                            {
                                version:        version,
                                title:          title,
                                copyright:      copyright,
                                description:    description,
                                date:           date,
                                image:          { url: image.url[0], link: image.link[0], title: image.title[0] },
                                items:          items
                            } )
                    } )
            } )
    }

    callback( null, self )

    return self
}