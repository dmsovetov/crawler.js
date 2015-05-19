cd "$(dirname $0)"
nohup sh -c './bin/mongod --dbpath db & ./bin/run' &