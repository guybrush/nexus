# nexus - remote program installation and control (work in progress/proof of concept)

         _______________________________
        /    ___  ___  _ _  _ _  ___    \
        |   |   || -_||_'_|| | ||_ -|   |
        |   |_|_||___||_,_||___||___|   |
        \_____________________________  / ____       ___
                                      \| / .  \  .-´/   \`-.
                                         \____ \/   \___/   \__
                                              \_`---´___`---´-´
                                               /../..\ /..\..\

* nexus provides a cli, a tcp/tls-interface to install, uninstall,
  start, stop and observe local and remote programs (npm packages).
* nexus is basically a mashup of [npm] and [dnode].
* programs are childprocesses of monitor-servers (node-tcp-servers)
* programs will be restarted by the monitor-servers when they crash
* monitor-servers are connected to a unix-socket, this socket can
  be used to control/query the monitor-servers
* all the config, logs and programs live in `~/.nexus` by default.
* ascii-font has been generated with `asciimo nexus Rectangles`.

## install

* install node
* install npm
* `npm install nexus`

## cli

## api

    var opts = 
      { prefix  : process.env.HOME+'/.nexus'
      , key     : ''
      , cert    : ''
      , keys    : ''
      , tmp     : ''
      , sockets : ''
      , apps    : ''
      , pids    : ''
      , logs    : ''
      , host    : ''
      , port    : 5001
      , remotes : {}
      }
      
    var nexus = require('nexus')(opts)

    nexus.version
    nexus.config(cb)
    nexus.config('key',cb)
    nexus.config('key','value',cb)

    nexus.install({},cb)
    nexus.uninstall({},cb)
    nexus.link({},cb)
    nexus.git({},cb)

    nexus.ls({},cb)
    nexus.ps({},function(err,apps){})

    // start an app, nexus-infos will be attached to process.env.nexus
    // (like start-time, restart-counter and if started via git-hook the 
    // git-ref - this may be handy for labeling metrics or any other
    // continuos deployment-stuff) 
    nexus.start({},function(err,data){})
    nexus.restart({},function(err,data){})
    nexus.stop('',function(err,data){})
    nexus.stopall(function(err,data){})

    nexus.app('',function(err,app){
      app.config()
      app.stdin()
      app.stdout()
      app.stderr()
    })

    nexus.server()
    nexus.web()
    nexus.remote()
    
## mount the webinterface on your webserver

    #TODO
    
## use the [dnode]-middleware

    // server:
    require('dnode')(require('nexus')(opts)).listen(1337)
    
    // the client could look like this:
    require('dnode').connect(1337,function(nexus){
      nexus.ps(function(err, runningPrograms){
        if (err) return console.log('something didnt work',err)
        console.log(runningPrograms)
      })
    })

## use the [browserify]- and the [stylus]-middleware
    
    #TODO

## build your own webinterface

    #TODO

[dnode]: https://github.com/substack/dnode
[npm]: https://github.com/isaacs/npm

