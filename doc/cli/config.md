# nexus-config(1) -- Manage nexus configuration

## SYNOPSIS

    nexus config

## DESCRIPTION

you can pass a string or an object to the nexus-constructor or use the (`-c`)
option with the cli. if you pass a string it will will be `require(string)`'ed.

* cli
    * `nexus -c /some/path/to/../file.json/or/file.js`
* api
    * `var nexus = require('nexus')('/some/path/to/a/file.json/or/file.js')`
    * `var nexus = require('nexus')({prefix:__dirname})`

if you dont pass any config-option the nexus will create a
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

## EXAMPLES

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

