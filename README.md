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

* nexus is basically a mashup of [npm], [hook.io] and [forever].
* nexus provides a cli and a hook.io-hook to install, uninstall, start, stop 
  and observe local and remote programs (npm packages).
* all the config, logs and programs live in `~/.nexus` by default.
* nexus is still *super-alpha*. 
* nexus may be obsolete since one can do all these things with [hook.io](?). in
  that case see this project as my learning-by-doing-thing `:)`.

## install

* install [node]
* install [npm]
* `npm install nexus`

## cli

TBA (look at the code for now)

## api

TBA (look at the code for now)

[hook.io]: https://github.com/hookio/hook.io
[forever]: https://github.com/nodejitsu/forever
[node]: http://nodejs.org
[npm]: https://npmjs.org

