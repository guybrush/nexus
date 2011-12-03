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
* this is just an experiment - most of the code is inspired by other tools. 
  you may want to use [forever] or [haibu] or [hook.io] which are better 
  supported and in general may be the better option for what ever you want to 
  do! 
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
[haibu]: https://github.com/nodejitsu/haibu
[hook.io]: https://github.com/hookio
[node]: http://nodejs.org
[npm]: https://npmjs.org

