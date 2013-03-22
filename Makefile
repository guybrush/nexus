install: mon

mon:
	cd deps/mon && make && cp -f mon ../../bin/mon
	
test: test-prepare
	node_modules/.bin/mocha
	
test-prepare:
	rm -rf test/tmp/* ^.gitignore
	cp -r test/fixtures/app test/tmp/app
	cd test/tmp/app
	git config user.email "foo@bar.com"
	git config user.name "foo bar"
	git init .
	git add .
	git commit -am"foo"
	
clean:
	cd deps/mon && make clean
	rm -rf test/tmp/* ^.gitignore

.PHONY: install mon clean test test-prepare
