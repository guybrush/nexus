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

* nexus is basically a mashup of [npm], [dnode] and [forever].
* nexus provides a cli and a dnode-interface to install, uninstall, start, stop 
  and observe local and remote programs (npm packages).
* all the config, logs and programs live in `~/.nexus` by default.
* this is still *super-alpha*. 

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

