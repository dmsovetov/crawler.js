var exec    = require( 'child_process' ).exec
  , fs      = require( 'fs' )
  , later   = require( 'later' )

// ** schedule
module.exports.schedule = function( params ) {
    params              = params            || {}
    params.path         = params.path       || 'backup'
    params.schedule     = params.schedule   || 'at 00:00 am'        // 'every 2 days'

    later.date.localTime()
    var schedule = later.parse.text( params.schedule )

    console.log( 'Backup scheduled, next backup time:', nextBackupTime() )

    // ** backup
    function backup( callback ) {
        // ** Run a backup
        exec( 'mongodump -d ' + params.db,
            function( err, stdout, stderr ) {
                if( err )           return callback( err )
                if( stderr != '' )  return callback( stderr )

                // ** Compress package
                exec( 'zip -r ' + formatBackupFileName() + ' dump',
                    function( err, stdout, stderr ) {
                        if( err )           return callback( err )
                        if( stderr != '' )  return callback( stderr )

                        // ** Remove folder
                        exec( 'rm -rf dump',
                            function( err, stdout, stderr ) {
                                if( err )           return callback( err )
                                if( stderr != '' )  return callback( stderr )

                                // ** Run a callback
                                callback()
                            } )
                    } )
            } )
    }

    // ** formatBackupFileName
    function formatBackupFileName() {
    	var now     = new Date()
        var day     = now.getDate()
        var month   = now.getMonth() + 1
        var year    = now.getFullYear()

        return params.path + '/' + params.db + '-' + (year + "-" + month + "-" + day) + '.zip'
    }

    // ** nextBackupTime
    function nextBackupTime() {
        return later.schedule( schedule ).next()
    }

    // ** Create backup folder
    fs.mkdir( params.path, 0777,
        function( err ) {
            if( err && err.code != 'EEXIST' ) return callback( err )

            // ** Create schedule
            later.setInterval(
                function() {
                    backup(
                        function( err ) {
                            console.log( err ? 'Failed to backup: ' + err : 'Backup completed, next backup time: ' + nextBackupTime() )
                        } )
                }, later.parse.text( params.schedule ) );
        } )
}