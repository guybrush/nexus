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

* nexus provides a cli and a [dnode]-interface to install, uninstall, start,
  stop and observe local and remote programs (npm packages).
* running programs are `require('child_process').spawn`'ed child-processes of
  monitor-servers (dnode-clients). monitor-servers connect (and reconnect) to
  the nexus-server (dnode-server). the nexus-server is also a
  `require('child_process').spawn`'ed child-process of a monitor-server -
  which itself will connect (and reconnect) to its own child-process.
* nexus shells out into [npm], is built upon [dnode] and is inspired by
  [forever]. (currently nexus depends on a [fork] of npm, which caches 
  git-remotes - so it has not to clone a fresh repository everytime, it will 
  just fetch deltas)
* all the config, logs and programs live in `~/.nexus` by default.
* nexus is still *super-alpha*.

[dnode]: https://github.com/substack/dnode
[forever]: https://github.com/nodejitsu/forever
[node]: http://nodejs.org
[npm]: https://npmjs.org
[fork]: https://github.com/guybrush/npm/tree/cacheGitRemotes

## install

* install [node]
* `npm install nexus -g`

## cli

```
nexus [-r <remote>] [-c <path to configFile>] [<command> [<options>]]

commands:

    version    .. print version-number
    config     .. print config
    ls         .. list installed packages
    install    .. install packages
    uninstall  .. uninstall packages
    ps         .. list of current running (and crashed) programs
    start      .. start a program
    restart    .. restart a running (or max crashed) program
    stop       .. stop a running program
    stopall    .. stop all running programs
    exec       .. execute a command with CWD = ~/.nexus/apps
    execscript .. execute a script, defined in a package.json
    logs       .. access log-files
    subscribe  .. subscribe to events
    server     .. start/stop/restart the nexus-server
    help       .. try `nexus help <command>` for more info

note: ps, restart, stop, stopall, subscribe and `logs clean`
      only work with a local or remote running nexus-server.
```

## config

you can pass a string or an object to the nexus-constructor or use the (`-c`)
option with the cli. if you pass a string it will will be `require(string)`'ed.

if you dont pass any config-option the nexus-cli will create a 
`~/.nexus`-directory if it doesnt exist and put all the configs and logs there.
it will try to `require('~/.nexus/config.js')` per default.

the default config is (which gets overwritten by the config you pass to nexus):
``` javascript
{ apps    : prefix+'/apps'   // nexus will install apps into that directory
, tmp     : prefix+'/tmp'    // apps will be installed here temporarily
, logs    : prefix+'/logs'   // this is where log-files will be put
, key     : null             // path to key-file - if set, the nexus-server uses tls
, cert    : null             // path to cert-file - if set, the nexus-server uses tls
, ca      : null             // every file in that directory will be read into the ca
, dbs     : prefix+'/dbs'    // nexus will store information about running processes in
                             // database-files (one per socket/port). these dbs will be
                             // used by the `nexus server reboot` command
, socket  : prefix+'/socket' // the nexus-server will listen on that UNIX-socket
                             // local cli and monitor-servers will connect to it
, port    : 0xf00            // the nexus-server will listen on that port
                             // remote nexus-cli can connect (see -r option)
, host    : '0.0.0.0'        // if a port is set the net/tls-server will be bound to it
, remotes : {}               // can be used with the cli: `nexus -r`
                             // a remote can contain the following keys:
                             // socket or port (in combination with key, cert, host)
}
```
where `prefix` is either `process.env.HOME+'/.nexus'` or
`process.env.USERPROFILE+'/.nexus'` depending on `process.platform`. (note that
nexus doesnt support win yet)

your config may look like this:
``` javascript
{ apps    : '/path/to/directory'
, socket  : '/path/to/socket'
, port    : 12345
, host    : '0.0.0.0'
, key     : '/path/to/key.pem'
, cert    : '/path/to/cert.pem'
, ca      : '/path/to/ca'
, remotes :
  { foo   : { port:12346, key:<key>, cert:<cert>, host:'foo.com' }
  , bar   : { port:12347, key:<key>, cert:<cert>, host:'bar.com' }
  }
}
```
now you can access the remote nexus-server `foo` with `nexus -r foo <command>`

or more simple - this will install all the things into `/var/nexus`:
```
{ prefix : '/var/nexus', port : 12345 }
```
the nexus-server will then listen on port `0.0.0.0:12345` *and* on the
unix-socket `/var/nexus/socket`.

