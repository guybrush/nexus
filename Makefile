install: mon

mon:
	cd deps/mon && make && cp -f mon ../../bin/mon
	
test: test-prepare
	node_modules/.bin/mocha
	
test-prepare:
	cp -r test/fixtures/app test/tmp/app
	cd test/tmp/app && git init . && git add . && git commit -am"foo"
	
clean:
	cd deps/mon && make clean
	rm -rf test/tmp/* ^.gitignore

.PHONY: install mon clean test test-prepare