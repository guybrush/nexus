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

* nexus is basically built upon [npm] and [dnode] (and inspired by [forever]).
* nexus provides a cli and a dnode-interface to install, uninstall, start, stop 
  and observe local and remote programs (npm packages).
* all the config, logs and programs live in `~/.nexus` by default.
* right now the whole thing is not as sane as it could be because of 
  [node-GH-2254](https://github.com/joyent/node/issues/2254).
* nexus is still *super-alpha*.

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

