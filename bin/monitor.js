#!/usr/bin/env node

var fork = require('child_process').fork 
  , forever = require('forever')
  , nexus = require('../index')
  , _config = nexus.config()
  
forever.load( { root     : _config.logs
              , pidPath  : _config.pids
              , sockPath : _config.socks } )

if (!process.env.nexus_monitor) {
  // i am the child  
  process.env.nexus_monitor = true
  var child = fork( __filename 
                  , process.argv.splice(2) 
                  , { env:process.env } )  
  child.on('message',function(m){            
    process.send && process.send(m)
    process.exit(0)
  })
} else {
  // i am the child of the child!
  var script = process.argv[2]
  var options =  process.argv.splice(3)
  var scriptConfig =
    { sourceDir : '/'
    , command   : 'node'
    , options   : options
    , forever   : true
    , max       : 10
    , env       : process.env
    , silent    : true
    }   
  
  var monitor = new forever.Monitor(script, scriptConfig).start()
  monitor.on('start',function(){
    forever.startServer(monitor)
    process.send('ready')
  })
}

