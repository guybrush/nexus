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

* install [node]
* install [npm]
* `npm install nexus`

## cli

TBA (look at the code for now)

## api

TBA (look at the code for now)

[dnode]: https://github.com/substack/dnode
[node]: http://nodejs.org
[npm]: https://npmjs.org

