# nexus - remote program installation and control (work in progress/proof of concept)

         _______________________________
        /    ___  ___  _ _  _ _  ___    \
        |   |   || -_||_'_|| | ||_ -|   |
        |   |_|_||___||_,_||___||___|   |
        |   turtles all the way down!   |
        \_____________________________  / ____       ___
                                      \| / .  \  .-´/   \`-.
                                         \____ \/   \___/   \__
                                              \_`---´___`---´-´
                                               /../..\ /..\..\

* nexus is basically built upon [npm] and [dnode] and is inspired by [forever].
* nexus provides a cli and a dnode-interface to install, uninstall, start, stop 
  and observe local and remote programs (npm packages).
* running programs are `require('child_process').spawn`'ed child-processes of
  monitor-servers (dnode-clients). the monitor-servers will try to reconnect to 
  the nexus-server (dnode-server) all the time. the nexus-server is also a 
  `require('child_process').spawn`'ed child-process of a monitor-server - 
  which itself will try to reconnect to its own child-process.
* all the config, logs and programs live in `~/.nexus` by default.
* note: deploying with npm is super fun, it gives you all sort of options.
  you can install by just pulling stuff from the npm-registry. though the
  [better option] is to pull from git-repositories (or generated tarballs of 
  git-repos) which contain all the `node_modules` - so you can be sure
  what you are installing.
* nexus is still *super-alpha*.

## install

* install [node]
* install [npm]
* `npm install nexus`

## cli

    nexus [-r <remote>] [-c <path to configFile>] [<command> [<options>]]
    
    commands:
    
        version   .. print version-number
        config    .. get/set config
        ls        .. list installed packages
        install   .. install packages
        uninstall .. uninstall packages
        ps        .. list of current running (and crashed) programs
        start     .. start a program
        restart   .. restart a running (or max crashed) program
        stop      .. stop a running program
        stopall   .. stop all running programs
        logs      .. access log-files
        cleanlogs .. remove old log-files (of not-running programs)
        subscribe .. subscribe to events
        server    .. start/stop/restart/get-info-about the nexus-server
        help      .. try `nexus help <command>` for more info
    
    note: ps, start, restart, stop, stopall, cleanlogs and subscribe
          only work with a local or remote running nexus-server

## api

    var config = '/path/to/config.js' // or json

    var nexus = require('nexus')(config)
    
    function cb(err, data) {console.log(data)}
    
    nexus.version(cb)
    nexus.config(cb)
    nexus.ls(cb)
    nexus.install({package:'helloworld',name:'some-name'},cb)
    nexus.uninstall('helloworld',cb)
    nexus.ps(cb)
    nexus.start({command:'node',script:'/path/to/script'},cb)
    nexus.restart('id',cb)            
    nexus.stop('id',cb)
    nexus.stopall(cb)
    nexus.logs({file:'file',lines:20},cb)
    nexus.cleanlogs(cb)
    nexus.server({cmd:'start',config:'/path/to/config.json'},cb)
    nexus.subscribe('*',function(event,data){console.log(event,'→',data)},cb)

[dnode]: https://github.com/substack/dnode
[forever]: https://github.com/nodejitsu/forever
[node]: http://nodejs.org
[npm]: https://npmjs.org
[better option]: http://www.mikealrogers.com/posts/nodemodules-in-git.html

