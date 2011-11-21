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

* nexus is basically a mashup of [npm], [dnode], redis and couchdb.
* nexus provides a cli and a dnode/redis/couchdb-interface to install, 
  uninstall, start, stop and observe local and remote programs (npm packages).
* the nexus-server is a node-tcp-server, which can be accessed via these
  interfaces.
* programs are controlled by monitor-servers (node-tcp-servers)
* monitor-servers are connected to unix-sockets or a dnode-server or redis or 
  couchdb. these tools can be used to control the programs.
* all the config, logs and programs live in `~/.nexus` by default.
* nexus is inspired by [forever].

## install

* install [node]
* install [npm]
* `npm install nexus`

## cli

TBA (look at the code for now)

## api

TBA (look at the code for now)

[dnode]: https://github.com/substack/dnode
[forever]: https://github.com/nodejitsu/forever
[node]: http://nodejs.org
[npm]: https://npmjs.org

