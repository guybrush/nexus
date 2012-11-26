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

[![build status](https://secure.travis-ci.org/guybrush/nexus.png)](http://travis-ci.org/guybrush/nexus)

* nexus provides a cli and a server with [dnode]-interface to install,
  uninstall, start, stop and observe local and remote programs.
* right now only git-repos can be installed.
* running programs are monitored with [mon].
* information about running programms is stored in a [dirty]-database.
* all the config, logs and programs live in `~/.nexus` by default.
* nexus is still *super-alpha* (and may change a lot). you may want to 
  checkout [fleet] which does similiar things differently.

[node]: http://nodejs.org
[dnode]: https://github.com/substack/dnode
[mon]: https://github.com/visionmedia/mon
[dirty]: https://github.com/felixge/node-dirty
[fleet]: https://github.com/substack/fleet

## install

* install [node]
* `npm install nexus -g`

## example

install a program locally in `~/.nexus/apps`

    nexus install https://github.com/visionmedia/express
   
we need to do `npm install` since `nexus` does *not* do anything but cloning
the repo. you can put a `nexus.json` into the root of your repo to tell `nexus`
what you want it to do upon installation (see `nexus help install`):
    
    nexus exec express -- npm install
    
install another version of the program, the name is now express_2 to avoid 
name-collision with the other program. now it will clone from a locally 
mirrored cache of the repo:
   
    nexus install https://github.com/visionmedia/express#2.5.11
    nexus exec express_1 -- npm install
 
start the resource-example with version 3.0.0rc3:

    nexus start express -- node examples/resource/app

start another process with version 2.5.11:
    
    nexus start express_1 -- node -e "require('./examples/resource/app').listen(3001)"

show all locally running processes:    

    nexus ps
    
uninstall programs:

    nexus rm express express_1
    
start a nexus server:

    nexus server start -p 3840
    
remotly install a program and start a process, stopall and uninstall:

    nexus -h 127.0.0.1 -p 3840 install https://github.com/visionmedia/express foo
    nexus -h 127.0.0.1 -p 3840 start foo -- node examples/blog/app
    nexus -h 127.0.0.1 -p 3840 ps
    nexus -h 127.0.0.1 -p 3840 stopall
    nexus -h 127.0.0.1 -p 3840 rm foo

## cli

    nexus [-r <remote>] [-c <path to configFile>] [<command> [<options>]]

commands:

* [version] - print version-number
* [config] - print config
* [ls] - list installed packages
* [install] - install packages
* [uninstall] - uninstall packages
* [ps] - list of current running (and crashed) programs
* [start] - start a program
* [restart] - restart a running (or max crashed) program
* [restartall] - restart all running programs
* [reboot] - reboot ghost-programs
* [stop] - stop a running program
* [stopall] - stop all running programs
* [exec] - execute a command
* [log] - access log-files
* [server] - control nexus-servers
* [help] - try `nexus help <command>` for more info

## api

```
var n = require('nexus')()

n.version(cb)

n.config(cb)

n.install(opts, cb)

n.uninstall(opts, cb)

n.ps(opts, cb)

n.start(opts, cb)

n.restart(opts, cb)

n.restartall(cb)

n.reboot(cb)

n.stop(id, cb)

n.stopall(cb)

n.exec(opts, cb)

n.log(opts, cb)

n.server(opts, cb)

n.connect(opts, cb)
```

