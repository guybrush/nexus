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
    restartall .. restart all running programs
    reboot     .. reboot ghost-programs
    stop       .. stop a running program
    stopall    .. stop all running programs
    exec       .. execute a command
    log        .. access log-files
    server     .. control nexus-servers
    help       .. try `nexus help <command>` for more info
```

## config

you can pass a string or an object to the nexus-constructor or use the (`-c`)
option with the cli. if you pass a string it will will be `require(string)`'ed.

* `var nexus = require('nexus')('/some/path/to/a/file.json/or/file.js')`
* `var nexus = require('nexus')({prefix:__dirname})`
* `nexus -c /some/path/to/../file.json/or/file.js`

if you dont pass any config-option the nexus-cli will create a
`~/.nexus`-directory if it doesnt exist and put all the configs and logs there.
it will try to `require('~/.nexus/config.js')` per default.

the default config is (which gets overwritten by the config you pass to nexus):

``` javascript
{ prefix  : process.env.HOME+'/.nexus' // is be used to prefix defaults
, apps    : prefix+'/apps'     // nexus will install apps into that directory
, tmp     : prefix+'/tmp'      // apps will be installed here temporarily
, logs    : prefix+'/logs'     // this is where log-files will be put
, key     : null               // path to key-file - if set, the nexus-server uses tls
, cert    : null               // path to cert-file - if set, the nexus-server uses tls
, ca      : null               // every file in that directory will be read into the ca
, db      : prefix+'/nexus.db' // nexus stores information about running processes there
, port    : 0xf00              // the nexus-server will listen on that port
                               // remote nexus-cli can connect (see -r option)
, host    : '0.0.0.0'          // if a port is set the net/tls-server will be bound to it
, socket  : null               // path to unix-socket, if set the server will also listen on it
, remotes : {}                 // can be used with the cli: `nexus -r`
                               // a remote is either a socket or a port
                               // (optional in combination with key, cert, host)
, error   : null               // if set (a string) it will be executed when a program exits
                               // CWD will be set to prefix, and ENV.NEXUS_MONITOR contains
                               // JSON.stringify'ed information about the chrashed program
}
```

your config may look like this:

``` javascript
{ apps    : '/path/to/directory'
, socket  : '/path/to/socket'
, port    : 12345
, host    : '0.0.0.0'
, key     : '/path/to/key.pem'
, cert    : '/path/to/cert.pem'
, ca      : '/path/to/ca'
, error   : 'echo "it crashed" > email'
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

the nexus-server will then listen on port `0.0.0.0:12345`.

