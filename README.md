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
* you can install a program with git (only) by using the `install` with a 
  git-url.
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

this will clone the repo into `~/.nexus/cache/<sha1(url)>` and checkout the
current master into `~/.nexus/apps/express`. now we have to install the 
dependencies since nexus doesnt do anything but git-clone/checkout if there 
is no `nexus.json` in the root-directory of the repository.
    
    nexus exec express -- npm install
  
install another version of the program, the name will be `express_1` to avoid 
name-collision with the other program. now it will fetch/update the local
cache of the repository and clone from that to save time:
   
    nexus install https://github.com/visionmedia/express#2.5.11
    nexus exec express_1 -- npm install
 
start the resource-example with in the current master-branch of express:

    nexus start express -- node examples/resource/app

start another process with version 2.5.11:
    
    nexus start express_1 -- node -e "require('./examples/resource/app').listen(3001)"

show all locally running processes:

    nexus ps
    
uninstall programs:

    nexus rm express express_1
    
start a nexus server:

    nexus server start -p 3840
    
remotely install a program and start a process, stopall and uninstall:

    nexus -h 123.4.5.6 -p 3840 install https://github.com/visionmedia/express foo
    nexus -h 123.4.5.6 -p 3840 start foo -- node examples/blog/app
    nexus -h 123.4.5.6 -p 3840 ps
    nexus -h 123.4.5.6 -p 3840 stopall
    nexus -h 123.4.5.6 -p 3840 rm foo

for further information please checkout the cli- and api-docs or take a look
at the tests.
    
## cli

    nexus [-r <remote>] [-c <path to configFile>] [<command> [<options>]]

commands:

* [cli-version] - print version-number
* [cli-config] - print config
* [cli-ls] - list installed packages
* [cli-install] - install packages
* [cli-uninstall] - uninstall packages
* [cli-ps] - list of current running (and crashed) programs
* [cli-start] - start a program
* [cli-restart] - restart a running (or max crashed) program
* [cli-restartall] - restart all running programs
* [cli-reboot] - reboot ghost-programs
* [cli-stop] - stop a running program
* [cli-stopall] - stop all running programs
* [cli-exec] - execute a command
* [cli-log] - access log-files
* [cli-server] - control nexus-servers
* [cli-help] - try `nexus help <command>` for more info

[cli-version]: https://github.com/guybrush/nexus/blob/master/doc/cli/version.md
[cli-config]: https://github.com/guybrush/nexus/blob/master/doc/cli/config.md
[cli-ls]: https://github.com/guybrush/nexus/blob/master/doc/cli/ls.md
[cli-uninstall]: https://github.com/guybrush/nexus/blob/master/doc/cli/uninstall.md
[cli-ps]: https://github.com/guybrush/nexus/blob/master/doc/cli/ps.md
[cli-start]: https://github.com/guybrush/nexus/blob/master/doc/cli/start.md
[cli-restart]: https://github.com/guybrush/nexus/blob/master/doc/cli/restart.md
[cli-restartall]: https://github.com/guybrush/nexus/blob/master/doc/cli/restartall.md
[cli-reboot]: https://github.com/guybrush/nexus/blob/master/doc/cli/reboot.md
[cli-stop]: https://github.com/guybrush/nexus/blob/master/doc/cli/stop.md
[cli-stopall]: https://github.com/guybrush/nexus/blob/master/doc/cli/stopall.md
[cli-exec]: https://github.com/guybrush/nexus/blob/master/doc/cli/exec.md
[cli-log]: https://github.com/guybrush/nexus/blob/master/doc/cli/log.md
[cli-server]: https://github.com/guybrush/nexus/blob/master/doc/cli/server.md
[cli-help]: https://github.com/guybrush/nexus/blob/master/doc/cli/help.md

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

