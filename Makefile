install: mon

mon:
	cd deps/mon && make && cp -f mon ../../bin/mon
	
test: test-prepare
	node_modules/.bin/mocha
	
test-prepare:
	rm -rf test/tmp/* ^.gitignore
	cp -r test/fixtures/app/_git test/fixtures/app/.git
	
clean:
	cd deps/mon && make clean
	rm -rf test/tmp/* ^.gitignore

.PHONY: install mon clean test test-prepare
