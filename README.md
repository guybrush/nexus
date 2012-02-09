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

* nexus provides a cli and a dnode-interface to install, uninstall, start, stop
  and observe local and remote programs (npm packages).
* running programs are `require('child_process').spawn`'ed child-processes of
  monitor-servers (dnode-clients). the monitor-servers will try to reconnect to
  the nexus-server (dnode-server). the nexus-server is also a
  `require('child_process').spawn`'ed child-process of a monitor-server -
  which itself will try to reconnect to its own child-process.
* all the config, logs and programs live in `~/.nexus` by default.
* nexus is built upon [npm] and [dnode] and is inspired by [forever].
* nexus is still *super-alpha*.

## install

* install [node]
* install [npm]
* `npm install nexus -g`
* `npm test nexus -g`

## cli

TBA

## api

TBA

[dnode]: https://github.com/substack/dnode
[forever]: https://github.com/nodejitsu/forever
[node]: http://nodejs.org
[npm]: https://npmjs.org
[better option]: http://www.mikealrogers.com/posts/nodemodules-in-git.html

